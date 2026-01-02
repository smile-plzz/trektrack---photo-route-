
export interface GPSLocation {
  lat: number;
  lng: number;
  alt?: number;
  timestamp?: Date;
}

export interface CameraMetadata {
  make?: string;
  model?: string;
  exposureTime?: string;
  fNumber?: string;
  iso?: string;
  focalLength?: string;
  lens?: string;
}

export interface TrekPhoto {
  id: string;
  name: string;
  url: string;
  base64: string;
  location?: GPSLocation;
  camera?: CameraMetadata;
  mimeType: string;
}
