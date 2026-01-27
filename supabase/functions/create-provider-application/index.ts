// Supabase Edge Function: Create Provider Application
// Purpose: Securely create provider account with all required records

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ProviderApplicationRequest {
  firstName: string
  middleName?: string
  lastName: string
  email: string
  password: string
  mobileNumber: string
  dateOfBirth: string // YYYY-MM-DD format
  hasSmartphone: boolean
  yearsOfExperience: number
  selectedCategories: string[] // Array of service_category IDs
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing required env vars')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with service role for full access
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Parse request body
    const body: ProviderApplicationRequest = await req.json()

    // Validate required fields
    if (!body.firstName || !body.lastName || !body.email || !body.password || 
        !body.mobileNumber || !body.dateOfBirth || !body.selectedCategories || 
        body.selectedCategories.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate age (must be 18+)
    const dob = new Date(body.dateOfBirth)
    const today = new Date()
    const age = today.getFullYear() - dob.getFullYear()
    const monthDiff = today.getMonth() - dob.getMonth()
    const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate()) 
      ? age - 1 
      : age

    if (actualAge < 18) {
      return new Response(
        JSON.stringify({ error: 'Must be at least 18 years old to apply' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate selected categories exist
    const { data: categories, error: categoryError } = await supabase
      .from('service_categories')
      .select('id')
      .in('id', body.selectedCategories)
      .eq('is_active', true)

    if (categoryError || !categories || categories.length !== body.selectedCategories.length) {
      return new Response(
        JSON.stringify({ error: 'Invalid service categories selected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Concatenate full name
    const fullName = [body.firstName, body.middleName, body.lastName]
      .filter(Boolean)
      .join(' ')

    // 1. Create auth user with role='provider' in metadata
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: false, // User will verify via OTP
      user_metadata: {
        phone: body.mobileNumber,
        role: 'provider', // IMPORTANT: Set role to provider
        full_name: fullName,
        date_of_birth: body.dateOfBirth
      }
    })

    if (authError || !authUser) {
      console.error('Auth user creation failed:', authError)
      if (authError?.message?.includes('already registered')) {
        return new Response(
          JSON.stringify({ error: 'Email already registered' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      return new Response(
        JSON.stringify({ error: 'Failed to create user account', details: authError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Auth user created:', authUser.user.id)

    // 2. Wait for profile creation via trigger (with retry logic)
    let profile = null
    let retries = 10
    while (retries > 0 && !profile) {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', authUser.user.id)
        .single()

      if (profileData) {
        profile = profileData
        break
      }

      // Wait 500ms before retry
      await new Promise(resolve => setTimeout(resolve, 500))
      retries--
    }

    if (!profile) {
      console.error('Profile creation timeout for user:', authUser.user.id)
      // Cleanup: delete auth user if profile wasn't created
      await supabase.auth.admin.deleteUser(authUser.user.id)
      return new Response(
        JSON.stringify({ error: 'Profile creation failed. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify profile has provider role
    if (profile.role !== 'provider') {
      console.error('Profile created with wrong role:', profile.role)
      await supabase.auth.admin.deleteUser(authUser.user.id)
      return new Response(
        JSON.stringify({ error: 'Failed to set provider role' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Profile created:', profile.id)

    // 3. Update profile with date_of_birth
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({ 
        date_of_birth: body.dateOfBirth,
        phone_number: body.mobileNumber
      })
      .eq('id', profile.id)

    if (profileUpdateError) {
      console.error('Profile update error:', profileUpdateError)
      // Continue anyway - not critical
    }

    // 4. Fetch After5 Verified Providers agency ID
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('id')
      .eq('name', 'After5 Verified Providers')
      .single()

    if (agencyError || !agency) {
      console.error('Agency lookup failed:', agencyError)
      await supabase.auth.admin.deleteUser(authUser.user.id)
      return new Response(
        JSON.stringify({ error: 'Default agency not found. Please contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Create provider record
    const { data: provider, error: providerError } = await supabase
      .from('providers')
      .insert({
        id: profile.id,
        agency_id: agency.id,
        years_of_experience: body.yearsOfExperience,
        has_smartphone: body.hasSmartphone,
        verification_status: 'pending',
        status: 'offline'
      })
      .select()
      .single()

    if (providerError || !provider) {
      console.error('Provider creation failed:', providerError)
      await supabase.auth.admin.deleteUser(authUser.user.id)
      return new Response(
        JSON.stringify({ error: 'Failed to create provider record', details: providerError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Provider record created:', provider.id)

    // 6. Fetch ALL service variants (to create offerings for all)
    const { data: allVariants, error: allVariantsError } = await supabase
      .from('service_variants')
      .select(`
        id,
        service_id,
        services!inner (
          category_id
        )
      `)
      .eq('is_active', true)

    if (allVariantsError) {
      console.error('Service variants fetch failed:', allVariantsError)
      // Continue - offerings can be created later
    }

    // 7. Create provider_offerings records for ALL variants
    // is_active = true for variants in selected categories, false for others
    if (allVariants && allVariants.length > 0) {
      // Get variant IDs for selected categories
      const selectedCategoryIds = new Set(body.selectedCategories)
      const activeVariantIds = new Set(
        allVariants
          .filter(v => selectedCategoryIds.has(v.services.category_id))
          .map(v => v.id)
      )

      // Create offerings for all variants
      const offerings = allVariants.map(variant => ({
        provider_id: provider.id,
        service_variant_id: variant.id,
        is_active: activeVariantIds.has(variant.id)
      }))

      const { error: offeringsError } = await supabase
        .from('provider_offerings')
        .insert(offerings)

      if (offeringsError) {
        console.error('Provider offerings creation failed:', offeringsError)
        // Continue anyway - offerings can be updated later
      } else {
        const activeCount = offerings.filter(o => o.is_active).length
        console.log(`Created ${offerings.length} provider offerings (${activeCount} active)`)
      }
    }

    // 8. Return success
    return new Response(
      JSON.stringify({
        success: true,
        userId: authUser.user.id,
        email: body.email,
        message: 'Provider application submitted successfully. Please verify your email.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
