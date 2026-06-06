import { useState, useRef, useCallback, type DragEvent } from 'react';
import { Button, Typography } from 'antd';
import {
  CloudUploadOutlined,
  FileOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

// ========== 格式化文件大小 ==========

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

// ========== Props ==========

interface FileUploaderProps {
  /** 已选文件 */
  file: File | null;
  /** 文件变化回调 */
  onFileChange: (file: File | null) => void;
  /** 允许的文件扩展名列表（如 ['pdf', 'docx', 'jpg']） */
  acceptFormats: string[];
  /** 最大文件大小（字节） */
  maxSize: number;
  /** 是否禁用（上传中/处理中时禁用） */
  disabled?: boolean;
  /** 已上传文件的 fileId（显示已上传状态） */
  uploadedFileId?: string | null;
}

/**
 * FileUploader — 拖拽/点击上传组件
 *
 * 支持拖拽和点击选择文件，校验类型和大小，
 * 显示文件预览（名称、大小），支持移除。
 */
export default function FileUploader({
  file,
  onFileChange,
  acceptFormats,
  maxSize,
  disabled = false,
  uploadedFileId,
}: FileUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 已上传完成
  const isUploaded = !!uploadedFileId && !!file;

  // ========== 校验文件 ==========

  const validateFile = useCallback(
    (f: File): string | null => {
      // 类型校验
      const ext = f.name.split('.').pop()?.toLowerCase();
      if (ext && acceptFormats.length > 0 && !acceptFormats.includes(ext)) {
        return `不支持 .${ext} 格式，请上传 ${acceptFormats.map((e) => `.${e}`).join('、')} 文件`;
      }
      // 大小校验
      if (f.size > maxSize) {
        return `文件大小超过限制（最大 ${formatSize(maxSize)}）`;
      }
      return null;
    },
    [acceptFormats, maxSize]
  );

  // ========== 处理文件选择 ==========

  const handleFile = useCallback(
    (f: File | null) => {
      setValidationError(null);
      if (!f) {
        onFileChange(null);
        return;
      }
      const err = validateFile(f);
      if (err) {
        setValidationError(err);
        onFileChange(null);
        return;
      }
      onFileChange(f);
    },
    [validateFile, onFileChange]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0] ?? null;
      handleFile(f);
      // 重置 input 以允许重复选择同一文件
      e.target.value = '';
    },
    [handleFile]
  );

  // ========== 拖拽处理 ==========

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) setIsDragOver(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (disabled) return;
      const f = e.dataTransfer.files?.[0] ?? null;
      handleFile(f);
    },
    [disabled, handleFile]
  );

  // ========== 点击上传 ==========

  const handleClick = useCallback(() => {
    if (!disabled && !isUploaded) inputRef.current?.click();
  }, [disabled, isUploaded]);

  // ========== MIME accept 字符串 ==========

  const acceptStr = acceptFormats.map((ext) => `.${ext}`).join(',');

  // ========== 渲染 ==========

  // 已上传成功状态
  if (isUploaded) {
    const ext = file!.name.split('.').pop()?.toUpperCase();
    return (
      <div className="border-2 border-green-300 bg-green-50 rounded-xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
            <CheckCircleOutlined className="text-xl text-green-500" />
          </div>
          <div className="flex-1 min-w-0">
            <Text strong className="block truncate text-sm">
              {file!.name}
            </Text>
            <Text type="secondary" className="text-xs">
              {formatSize(file!.size)} · {ext}
            </Text>
          </div>
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => onFileChange(null)}
            disabled={disabled}
          />
        </div>
      </div>
    );
  }

  // 已选择但未上传
  if (file) {
    const ext = file.name.split('.').pop()?.toUpperCase();
    return (
      <div className="border-2 border-blue-200 bg-blue-50 rounded-xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
            <FileOutlined className="text-xl text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <Text strong className="block truncate text-sm">
              {file.name}
            </Text>
            <Text type="secondary" className="text-xs">
              {formatSize(file.size)} · {ext}
            </Text>
          </div>
          {!disabled && (
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => onFileChange(null)}
            />
          )}
        </div>
      </div>
    );
  }

  // 拖拽/点击上传区域
  return (
    <div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
          disabled
            ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
            : isDragOver
              ? 'border-primary-400 bg-primary-50 scale-[1.02]'
              : 'border-gray-300 bg-gray-50/50 hover:border-primary-300 hover:bg-primary-50/30'
        }`}
      >
        <CloudUploadOutlined
          className={`text-4xl mb-3 ${isDragOver ? 'text-primary-500' : 'text-gray-400'}`}
        />
        <div className="mb-1">
          <Text className="text-sm">
            拖拽文件到此处，或 <span className="text-primary-500">点击选择</span>
          </Text>
        </div>
        <Text type="secondary" className="text-xs">
          支持 {acceptFormats.map((e) => `.${e}`).join('、')}，最大 {formatSize(maxSize)}
        </Text>
      </div>

      {/* 校验错误 */}
      {validationError && (
        <div className="mt-3 flex items-center gap-2 text-red-500 text-sm">
          <ExclamationCircleOutlined />
          <span>{validationError}</span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={acceptStr}
        onChange={handleInputChange}
        className="hidden"
      />
    </div>
  );
}
