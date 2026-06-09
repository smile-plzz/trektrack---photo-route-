
import ExifReader from 'exifreader';
import { GPSLocation, CameraMetadata } from '../types';

const parseNumericDescription = (value: unknown): number | undefined => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;

  const normalized = value.trim();
  if (!normalized) return undefined;

  const fraction = normalized.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);
    return denominator ? numerator / denominator : undefined;
  }

  const decimal = Number(normalized);
  return Number.isFinite(decimal) ? decimal : undefined;
};

const parseGpsCoordinate = (tag: any, ref?: string): number | undefined => {
  const fromDescription = parseNumericDescription(tag?.description);
  if (fromDescription !== undefined) {
    return ref === 'S' || ref === 'W' ? -Math.abs(fromDescription) : fromDescription;
  }

  const value = tag?.value;
  if (!Array.isArray(value) || value.length < 3) return undefined;

  const parts = value.map((part) => {
    if (typeof part === 'number') return part;
    if (Array.isArray(part) && part.length >= 2) return part[1] ? part[0] / part[1] : 0;
    if (typeof part === 'object' && part !== null && 'numerator' in part && 'denominator' in part) {
      const rational = part as { numerator: number; denominator: number };
      return rational.denominator ? rational.numerator / rational.denominator : 0;
    }
    return parseNumericDescription(part);
  });

  if (parts.some((part) => part === undefined)) return undefined;
  const decimal = parts[0]! + parts[1]! / 60 + parts[2]! / 3600;
  return ref === 'S' || ref === 'W' ? -decimal : decimal;
};

const parseExifDate = (description?: string): Date | undefined => {
  if (!description) return undefined;
  const normalized = description.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export const extractGpsData = async (file: File): Promise<GPSLocation | undefined> => {
  try {
    const tags = await ExifReader.load(file);
    
    if (tags.GPSLatitude && tags.GPSLongitude) {
      const latRef = tags.GPSLatitudeRef?.description || tags.GPSLatitudeRef?.value?.[0];
      const lngRef = tags.GPSLongitudeRef?.description || tags.GPSLongitudeRef?.value?.[0];
      const lat = parseGpsCoordinate(tags.GPSLatitude, latRef);
      const lng = parseGpsCoordinate(tags.GPSLongitude, lngRef);
      const alt = parseNumericDescription(tags.GPSAltitude?.description);
      const timestamp = parseExifDate(tags.DateTimeOriginal?.description || tags.DateTime?.description);

      if (lat === undefined || lng === undefined) return undefined;

      return {
        lat,
        lng,
        alt,
        timestamp
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

export const fileToBase64 = (file: Blob): Promise<string> => {
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
