
import ExifReader from 'https://esm.sh/exifreader';
import { GPSLocation, CameraMetadata } from '../types';

export const extractGpsData = async (file: File): Promise<GPSLocation | undefined> => {
  try {
    const tags = await ExifReader.load(file);
    
    if (tags.GPSLatitude && tags.GPSLongitude) {
      const lat = tags.GPSLatitude.description as unknown as number;
      const lng = tags.GPSLongitude.description as unknown as number;
      const alt = tags.GPSAltitude ? (tags.GPSAltitude.description as unknown as number) : undefined;
      
      let date: Date | undefined;
      if (tags.DateTimeOriginal) {
        const dateStr = tags.DateTimeOriginal.description?.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
        if (dateStr) date = new Date(dateStr);
      }

      return {
        lat: Number(lat),
        lng: Number(lng),
        alt: alt ? Number(alt) : undefined,
        timestamp: date
      };
    }
  } catch (error) {
    console.error("Error reading GPS data:", error);
  }
  return undefined;
};

export const extractCameraMetadata = async (file: File): Promise<CameraMetadata> => {
  try {
    const tags = await ExifReader.load(file);
    return {
      make: tags.Make?.description,
      model: tags.Model?.description,
      exposureTime: tags.ExposureTime?.description,
      fNumber: tags.FNumber?.description,
      iso: tags.ISOSpeedRatings?.description,
      focalLength: tags.FocalLength?.description,
      lens: tags.LensModel?.description || tags.Lens?.description
    };
  } catch (error) {
    console.error("Error reading camera EXIF:", error);
    return {};
  }
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = reader.result?.toString().split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};
