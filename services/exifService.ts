import ExifReader from 'https://esm.sh/exifreader';
import { GPSLocation, CameraMetadata } from '../types';

export const extractGpsData = async (file: File): Promise<GPSLocation | undefined> => {
  try {
    const tags = await ExifReader.load(file);
    
    if (tags.GPSLatitude && tags.GPSLongitude) {
      // Direct numeric conversion from description
      const lat = Number(tags.GPSLatitude.description);
      const lng = Number(tags.GPSLongitude.description);
      const alt = tags.GPSAltitude ? Number(tags.GPSAltitude.description) : undefined;
      
      let date: Date | undefined;
      // Prefer DateTimeOriginal for exact moment of capture
      const rawDateStr = tags.DateTimeOriginal?.description || tags.DateTime?.description;
      
      if (rawDateStr) {
        // EXIF format is typically YYYY:MM:DD HH:MM:SS
        const isoDateStr = rawDateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
        const parsed = new Date(isoDateStr);
        if (!isNaN(parsed.getTime())) {
          date = parsed;
        }
      }

      return {
        lat,
        lng,
        alt: isNaN(alt as number) ? undefined : alt,
        timestamp: date
      };
    }
  } catch (error) {
    console.error("EXIF Parsing Error:", error);
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
    console.error("Hardware Metadata Error:", error);
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