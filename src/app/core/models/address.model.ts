export interface UserAddress {
  id: string;
  user_id: string;
  label: string;
  is_default: boolean;
  full_address: string;
  unit_details?: string;
  access_instructions?: string;
  has_parking: boolean;
  parking_instructions?: string;
  location: {
    lat: number;
    lng: number;
  };
  hasValidLocation?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAddressRequest {
  label: string;
  is_default?: boolean;
  full_address: string;
  unit_details?: string;
  access_instructions?: string;
  has_parking?: boolean;
  parking_instructions?: string;
  latitude: number;
  longitude: number;
}

export interface UpdateAddressRequest extends Partial<CreateAddressRequest> {
  id: string;
}

export interface GooglePlaceResult {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  address: string;
}