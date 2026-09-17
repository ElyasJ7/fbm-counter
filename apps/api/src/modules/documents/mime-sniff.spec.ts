import { isOleCompound, sniffMimeType } from './mime-sniff';

describe('mime-sniff', () => {
  it('detects PDF', () => {
    expect(sniffMimeType(Buffer.from('%PDF-1.4'))).toBe('application/pdf');
  });

  it('detects PNG', () => {
    expect(
      sniffMimeType(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe('image/png');
  });

  it('detects JPEG', () => {
    expect(sniffMimeType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      'image/jpeg',
    );
  });

  it('detects ZIP containers', () => {
    expect(sniffMimeType(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]))).toBe(
      'application/zip',
    );
  });

  it('detects plain text', () => {
    expect(sniffMimeType(Buffer.from('Hello world notes'))).toBe('text/plain');
  });

  it('detects OLE compounds', () => {
    expect(
      isOleCompound(
        Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      ),
    ).toBe(true);
  });
});
