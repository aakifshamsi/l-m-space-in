import QRCode from 'qrcode';

// Generate QR code as SVG string
export async function generateQRSvg(url: string, size: number = 200): Promise<string> {
  try {
    const svg = await QRCode.toString(url, {
      type: 'svg',
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
    return svg;
  } catch (error) {
    console.error('QR generation error:', error);
    throw new Error('Failed to generate QR code');
  }
}

// Generate QR code as data URL (base64)
export async function generateQRDataUrl(url: string, size: number = 200): Promise<string> {
  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
    return dataUrl;
  } catch (error) {
    console.error('QR generation error:', error);
    throw new Error('Failed to generate QR code');
  }
}

// Generate QR for link
export async function generateLinkQR(baseUrl: string, slug: string, size: number = 200): Promise<string> {
  const fullUrl = `${baseUrl}/${slug}`;
  return generateQRSvg(fullUrl, size);
}

export type QRService = {
  generateQRSvg: typeof generateQRSvg;
  generateQRDataUrl: typeof generateQRDataUrl;
  generateLinkQR: typeof generateLinkQR;
};