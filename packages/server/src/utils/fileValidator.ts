import fs from 'fs/promises';

/**
 * 文件头签名映射表
 * 通过读取文件的前几个字节（magic bytes）来判断真实文件类型
 * 防止用户伪造 MIME 类型上传恶意文件
 */
const FILE_SIGNATURES: Record<string, { mime: string; ext: string }> = {
  // 图片
  ffd8ff: { mime: 'image/jpeg', ext: '.jpg' },
  '89504e47': { mime: 'image/png', ext: '.png' },
  '47494638': { mime: 'image/gif', ext: '.gif' },
  '52494646': { mime: 'image/webp', ext: '.webp' }, // RIFF header (WebP)
  '000000': { mime: 'image/svg+xml', ext: '.svg' }, // SVG 是文本，无固定签名
  '424d': { mime: 'image/bmp', ext: '.bmp' },
  // 文档
  '25504446': { mime: 'application/pdf', ext: '.pdf' },
  '504b0304': { mime: 'application/zip', ext: '.zip' }, // ZIP (docx/xlsx/pptx 也是 ZIP)
  d0cf11e0: { mime: 'application/msword', ext: '.doc' }, // OLE2 (旧版 Office)
  // 音频
  '49443303': { mime: 'audio/mpeg', ext: '.mp3' }, // ID3v2
  fff3: { mime: 'audio/mpeg', ext: '.mp3' }, // MP3 frame sync
  fff2: { mime: 'audio/mpeg', ext: '.mp3' },
  '664c6143': { mime: 'audio/flac', ext: '.flac' },
  '4f676753': { mime: 'audio/ogg', ext: '.ogg' },
  '52494646a': { mime: 'audio/wav', ext: '.wav' }, // RIFF (WAV)
  // 视频
  '00000018': { mime: 'video/mp4', ext: '.mp4' },
  '0000001c': { mime: 'video/mp4', ext: '.mp4' },
  '00000020': { mime: 'video/mp4', ext: '.mp4' },
  '1a45dfa3': { mime: 'video/x-matroska', ext: '.mkv' },
  '464c56': { mime: 'video/x-flv', ext: '.flv' },
  '52494646v': { mime: 'video/avi', ext: '.avi' }, // RIFF (AVI)
};

/**
 * 读取文件头并识别真实 MIME 类型
 */
export async function detectFileType(
  filePath: string
): Promise<{ mime: string; ext: string } | null> {
  try {
    const handle = await fs.open(filePath, 'r');
    const buffer = Buffer.alloc(16);
    await handle.read(buffer, 0, 16, 0);
    await handle.close();

    const hex = buffer.toString('hex').toLowerCase();

    // 遍历签名表匹配
    for (const [signature, info] of Object.entries(FILE_SIGNATURES)) {
      if (hex.startsWith(signature)) {
        return info;
      }
    }

    // 特殊处理：ZIP 格式可能是 Office 文档
    if (hex.startsWith('504b0304')) {
      return { mime: 'application/zip', ext: '.zip' };
    }

    // 特殊处理：检查是否是 SVG（文本格式）
    const textContent = buffer.toString('utf8', 0, 16).trim();
    if (textContent.startsWith('<?xml') || textContent.startsWith('<svg')) {
      return { mime: 'image/svg+xml', ext: '.svg' };
    }

    // 特殊处理：检查是否是 Markdown / 纯文本
    if (/^[\x20-\x7E\n\r\t]+$/u.test(textContent)) {
      return { mime: 'text/plain', ext: '.txt' };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * 校验文件真实类型是否与声明的 MIME 类型一致
 */
export async function validateFileMimeType(
  filePath: string,
  declaredMime: string
): Promise<{ valid: boolean; realMime: string | null }> {
  const detected = await detectFileType(filePath);

  if (!detected) {
    // 无法识别时，信任声明的 MIME 类型（但记录警告）
    return { valid: true, realMime: declaredMime };
  }

  // 宽泛匹配：ZIP 类型兼容 Office 文档
  const zipOfficeTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ];

  if (detected.mime === 'application/zip' && zipOfficeTypes.includes(declaredMime)) {
    return { valid: true, realMime: declaredMime };
  }

  // RIFF 类型兼容 WebP / WAV / AVI
  if (detected.mime === 'image/webp' && declaredMime === 'image/webp') {
    return { valid: true, realMime: 'image/webp' };
  }
  if (detected.mime === 'audio/wav' && declaredMime === 'audio/wav') {
    return { valid: true, realMime: 'audio/wav' };
  }
  if (detected.mime === 'video/avi' && declaredMime === 'video/x-msvideo') {
    return { valid: true, realMime: 'video/x-msvideo' };
  }

  // 精确匹配
  if (detected.mime === declaredMime) {
    return { valid: true, realMime: detected.mime };
  }

  // MP3 多种签名
  if (declaredMime === 'audio/mpeg' && detected.mime === 'audio/mpeg') {
    return { valid: true, realMime: 'audio/mpeg' };
  }

  // MP4 多种签名
  if (declaredMime === 'video/mp4' && detected.mime === 'video/mp4') {
    return { valid: true, realMime: 'video/mp4' };
  }

  return { valid: false, realMime: detected.mime };
}
