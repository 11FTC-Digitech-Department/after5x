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
  userId?: string // Optional: if provided, use existing user (for backward compatibility)
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
    // If userId is not provided, email and password are required
    if (!body.userId && (!body.email || !body.password)) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required when userId is not provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!body.firstName || !body.lastName || !body.mobileNumber || !body.dateOfBirth || 
        !body.selectedCategories || body.selectedCategories.length === 0) {
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

    // Check for existing email in profiles or auth.users
    const { data: existingEmailProfile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', body.email.toLowerCase().trim())
      .maybeSingle()

    if (existingEmailProfile) {
      // 200 + success:false so Supabase invoke() passes body (non-2xx discards body)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'This email address is already registered. Please use a different email or try signing in.',
          code: 'EMAIL_EXISTS'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check for existing mobile number in profiles
    const { data: existingPhoneProfile } = await supabase
      .from('profiles')
      .select('id, phone_number')
      .eq('phone_number', body.mobileNumber.trim())
      .maybeSingle()

    if (existingPhoneProfile) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'This mobile number is already registered. Please use a different mobile number or try signing in.',
          code: 'PHONE_EXISTS'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Concatenate full name
    const fullName = [body.firstName, body.middleName, body.lastName]
      .filter(Boolean)
      .join(' ')

    // 1. Create or use existing auth user
    let authUser: { user: { id: string; email?: string } } | null = null
    let userEmail = body.email

    if (body.userId) {
      // Use existing user (backward compatibility)
      const { data: existingUser, error: userError } = await supabase.auth.admin.getUserById(body.userId)
      if (userError || !existingUser) {
        return new Response(
          JSON.stringify({ error: 'Invalid userId provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      authUser = { user: { id: body.userId, email: existingUser.user.email } }
      userEmail = existingUser.user.email || body.email
    } else {
      // Create new auth user with role='provider' in metadata
      const { data: newAuthUser, error: authError } = await supabase.auth.admin.createUser({
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

      if (authError || !newAuthUser) {
        console.error('Auth user creation failed:', authError)
        
        // Check for various email already exists error messages
        const errorMessage = authError?.message?.toLowerCase() || ''
        if (errorMessage.includes('already registered') || 
            errorMessage.includes('user already registered') ||
            errorMessage.includes('email already exists') ||
            errorMessage.includes('duplicate key value')) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'This email address is already registered. Please use a different email or try signing in.',
              code: 'EMAIL_EXISTS'
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        return new Response(
          JSON.stringify({ 
            error: 'Failed to create your account. Please try again or contact support if the problem persists.',
            details: authError?.message 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      authUser = newAuthUser
    }

    console.log('Auth user ready:', authUser.user.id)

    // 2. Wait for profile creation via trigger (with retry logic)
    let profile = null
    let retries = 20 // Increased from 10 to 20 (10 seconds total)
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

      if (profileError) {
        console.error('Profile query error:', profileError)
      }

      // Wait 500ms before retry
      await new Promise(resolve => setTimeout(resolve, 500))
      retries--
    }

    if (!profile) {
      console.error('Profile creation timeout for user:', authUser.user.id)
      console.error('Auth user created but profile was not found after 10 seconds')
      // Check if profile exists with different query
      const { data: checkProfile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', authUser.user.id)
        .maybeSingle()
      
      if (checkProfile) {
        console.log('Profile found on second check:', checkProfile)
        profile = checkProfile
      } else {
        // Fallback: Create profile directly if trigger failed
        console.log('Trigger failed, creating profile directly as fallback')
        const fullName = [body.firstName, body.middleName, body.lastName]
          .filter(Boolean)
          .join(' ')
        
        // Use upsert to handle potential conflicts (e.g., if trigger partially succeeded)
        const { data: createdProfile, error: createError } = await supabase
          .from('profiles')
          .upsert({
            id: authUser.user.id,
            email: body.email,
            full_name: fullName,
            role: 'provider',
            phone_number: body.mobileNumber,
            activated: false,
            date_of_birth: body.dateOfBirth || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id',
            ignoreDuplicates: false
          })
          .select('id, role')
          .single()
        
        if (createError) {
          console.error('Fallback profile creation failed:', createError)
          console.error('Error details:', JSON.stringify(createError, null, 2))
          
          // Try to fetch the profile one more time in case it was created between checks
          const { data: finalCheck } = await supabase
            .from('profiles')
            .select('id, role')
            .eq('id', authUser.user.id)
            .maybeSingle()
          
          if (finalCheck) {
            console.log('Profile found on final check:', finalCheck)
            profile = finalCheck
          } else {
            // Cleanup: delete auth user if profile wasn't created
            await supabase.auth.admin.deleteUser(authUser.user.id)
            return new Response(
              JSON.stringify({ 
                error: 'Profile creation failed. Please try again.',
                details: createError.message 
              }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        } else if (!createdProfile) {
          console.error('Upsert returned no data')
          // Cleanup: delete auth user if profile wasn't created
          await supabase.auth.admin.deleteUser(authUser.user.id)
          return new Response(
            JSON.stringify({ error: 'Profile creation failed. Please try again.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } else {
          console.log('Profile created via fallback:', createdProfile.id)
          profile = createdProfile
        }
      }
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

    // 8. Send verification email
    let emailSent = false
    let emailError: string | null = null

    // Only send verification email if user was just created (not using existing userId)
    if (!body.userId) {
      try {
        // Trigger Supabase Auth email delivery (uses Mailpit locally, SMTP in production)
        const { error: resendError } = await supabase.auth.resend({
          type: 'signup',
          email: userEmail,
          options: {
            emailRedirectTo: 'https://app.after5.ph/auth/verify-email'
          }
        })

        if (resendError) {
          console.error('Failed to send verification email:', resendError)
          emailError = resendError.message
        } else {
          emailSent = true
          console.log('Verification email sent to:', userEmail)
        }
      } catch (emailErr) {
        console.error('Error sending verification email:', emailErr)
        emailError = emailErr instanceof Error ? emailErr.message : 'Unknown error'
        // Don't fail the entire signup if email sending fails - user can request resend later
      }
    }

    // 9. Return success
    return new Response(
      JSON.stringify({
        success: true,
        userId: authUser.user.id,
        email: userEmail,
        emailSent,
        emailError: emailError || undefined,
        message: emailSent 
          ? 'Provider application submitted successfully. Please verify your email to complete your application.'
          : 'Provider application submitted successfully. Please verify your email to complete your application.'
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
