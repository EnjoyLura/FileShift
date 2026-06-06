import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

const execFileAsync = promisify(execFile);

/**
 * LibreOffice 可执行文件路径
 * 自动检测系统安装位置
 */
function detectLibreOfficePath(): string {
  // 1. 环境变量优先
  if (process.env.LIBREOFFICE_PATH) {
    return process.env.LIBREOFFICE_PATH;
  }

  const platform = process.platform;

  if (platform === 'linux') {
    // Linux 常见路径
    const linuxPaths = ['/usr/bin/soffice', '/usr/bin/libreoffice', '/usr/local/bin/soffice'];
    for (const p of linuxPaths) {
      if (fs.existsSync(p)) return p;
    }
    return 'soffice'; // 依赖 PATH
  }

  if (platform === 'darwin') {
    // macOS
    const macPaths = [
      '/Applications/LibreOffice.app/Contents/MacOS/soffice',
      '/Applications/OpenOffice.app/Contents/MacOS/soffice',
    ];
    for (const p of macPaths) {
      if (fs.existsSync(p)) return p;
    }
    return 'soffice';
  }

  if (platform === 'win32') {
    // Windows 常见安装路径
    const winPaths = [
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
      `${process.env.PROGRAMFILES}\\LibreOffice\\program\\soffice.exe`,
      `${process.env['PROGRAMFILES(X86)']}\\LibreOffice\\program\\soffice.exe`,
    ];
    for (const p of winPaths) {
      if (p && fs.existsSync(p)) return p;
    }
    return 'soffice.exe'; // 依赖 PATH
  }

  return 'soffice';
}

const LIBREOFFICE_PATH = detectLibreOfficePath();

/**
 * 检测 LibreOffice 是否可用
 */
export async function isLibreOfficeAvailable(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(LIBREOFFICE_PATH, ['--version'], {
      timeout: 10000,
    });
    logger.info({ version: stdout.trim(), path: LIBREOFFICE_PATH }, 'LibreOffice detected');
    return true;
  } catch {
    return false;
  }
}

/**
 * 使用 LibreOffice 进行文件格式转换
 *
 * @param inputFilePath 输入文件路径
 * @param outputDir 输出目录
 * @param targetFormat 目标格式（pdf, docx, xlsx, pptx, html 等）
 * @returns 输出文件路径
 */
export async function convertWithLibreOffice(
  inputFilePath: string,
  outputDir: string,
  targetFormat: string
): Promise<string> {
  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  logger.info(
    {
      input: inputFilePath,
      outputDir,
      targetFormat,
      libreoffice: LIBREOFFICE_PATH,
    },
    'Starting LibreOffice conversion'
  );

  const startTime = Date.now();

  try {
    // LibreOffice headless 转换命令
    const args = [
      '--headless',
      '--norestore',
      '--invisible',
      '--nocrashreport',
      '--nodefault',
      '--nofirststartwizard',
      '--nologo',
      '--convert-to',
      targetFormat,
      '--outdir',
      path.resolve(outputDir),
      path.resolve(inputFilePath),
    ];

    const { stdout: _stdout, stderr } = await execFileAsync(LIBREOFFICE_PATH, args, {
      timeout: 120000, // 2分钟超时
      maxBuffer: 10 * 1024 * 1024,
      // 使用 HOME 环境变量避免配置文件冲突
      env: {
        ...process.env,
        HOME: outputDir,
        USERPROFILE: outputDir,
      },
    });

    if (stderr) {
      logger.warn({ stderr: stderr.trim() }, 'LibreOffice stderr');
    }

    const elapsed = Date.now() - startTime;

    // 推断输出文件名
    const baseName = path.basename(inputFilePath, path.extname(inputFilePath));
    const ext = targetFormat.includes(':') ? targetFormat.split(':')[0] : targetFormat;
    const outputFileName = `${baseName}.${ext}`;
    const outputPath = path.join(outputDir, outputFileName);

    if (!fs.existsSync(outputPath)) {
      // LibreOffice 可能使用不同的输出文件名
      const files = fs.readdirSync(outputDir).filter((f) => {
        const fBase = path.basename(f, path.extname(f));
        return fBase === baseName && path.extname(f) === `.${ext}`;
      });

      if (files.length > 0) {
        const actualPath = path.join(outputDir, files[0]);
        logger.info(
          { elapsed: `${elapsed}ms`, outputPath: actualPath },
          'LibreOffice conversion completed'
        );
        return actualPath;
      }

      throw new Error(`转换输出文件未找到: ${outputPath}`);
    }

    logger.info({ elapsed: `${elapsed}ms`, outputPath }, 'LibreOffice conversion completed');
    return outputPath;
  } catch (error) {
    const elapsed = Date.now() - startTime;
    logger.error(
      {
        elapsed: `${elapsed}ms`,
        error: error instanceof Error ? error.message : String(error),
      },
      'LibreOffice conversion failed'
    );

    if (error instanceof Error && error.message.includes('timeout')) {
      throw new Error('文件转换超时（超过120秒），请尝试转换较小的文件');
    }

    throw new Error(`LibreOffice 转换失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 支持的转换格式
 */
export const LIBREOFFICE_CONVERSIONS = {
  // PDF → 其他
  'pdf-to-word': { target: 'docx', inputExt: '.pdf', outputExt: '.docx' },
  'pdf-to-excel': { target: 'xlsx', inputExt: '.pdf', outputExt: '.xlsx' },
  'pdf-to-ppt': { target: 'pptx', inputExt: '.pdf', outputExt: '.pptx' },
  'pdf-to-image': { target: 'png', inputExt: '.pdf', outputExt: '.png' },

  // 其他 → PDF
  'word-to-pdf': { target: 'pdf', inputExt: '.docx', outputExt: '.pdf' },
  'excel-to-pdf': { target: 'pdf', inputExt: '.xlsx', outputExt: '.pdf' },
  'ppt-to-pdf': { target: 'pdf', inputExt: '.pptx', outputExt: '.pdf' },
  'image-to-pdf': { target: 'pdf', inputExt: '.jpg', outputExt: '.pdf' },

  // 旧版 Office 格式
  'doc-to-pdf': { target: 'pdf', inputExt: '.doc', outputExt: '.pdf' },
  'xls-to-pdf': { target: 'pdf', inputExt: '.xls', outputExt: '.pdf' },
  'ppt-old-to-pdf': { target: 'pdf', inputExt: '.ppt', outputExt: '.pdf' },
} as const;
