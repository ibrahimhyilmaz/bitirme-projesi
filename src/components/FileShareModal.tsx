import React, { useRef, useState } from 'react';
import {
  FolderOpen,
  Upload,
  Download,
  Trash2,
  PlusCircle,
  File,
  FileImage,
  FileText,
  X,
} from 'lucide-react';
import { SharedFile } from '../types';

interface FileShareModalProps {
  files: SharedFile[];
  onUploadFile: (fileData: { name: string; size: number; fileType: string; dataUrl: string }) => void;
  onDeleteFile: (fileId: string) => void;
  onAddImageToCanvas: (dataUrl: string, name: string) => void;
  onClose: () => void;
}

export const FileShareModal: React.FC<FileShareModalProps> = ({
  files,
  onUploadFile,
  onDeleteFile,
  onAddImageToCanvas,
  onClose,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      onUploadFile({
        name: file.name,
        size: file.size,
        fileType: file.type,
        dataUrl,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <FileImage className="w-5 h-5 text-blue-500" />;
    if (type.includes('text') || type.includes('json') || type.includes('markdown')) {
      return <FileText className="w-5 h-5 text-emerald-500" />;
    }
    return <File className="w-5 h-5 text-amber-500" />;
  };

  return (
    <div className="fixed top-16 right-4 bottom-6 w-[480px] max-w-[calc(100vw-32px)] z-30 bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden select-none">
      {/* Header */}
      <div className="h-12 bg-slate-50 border-b border-slate-200 px-4 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-blue-600" />
          <span className="font-bold text-slate-800">Paylaşılan Dosyalar</span>
          <span className="text-slate-400">·</span>
          <span className="font-mono text-slate-500">{files.length} dosya</span>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          title="Kapat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Upload Drop Zone */}
      <div className="p-4 border-b border-slate-100">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50/50'
              : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-slate-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            className="hidden"
          />
          <Upload className="w-6 h-6 text-slate-400 mb-2" />
          <p className="text-xs font-semibold text-slate-700">
            Dosya yüklemek için tıklayın veya sürükleyip bırakın
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Görseller (PNG, JPG), belgeler ve şemalar
          </p>
        </div>
      </div>

      {/* Files List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {files.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-12">
            <FolderOpen className="w-10 h-10 stroke-1 mb-2 text-slate-300" />
            <p className="text-xs font-medium text-slate-600">Henüz dosya paylaşılmadı</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
              Odadaki üyelerle paylaşmak istediğiniz dosyaları buraya bırakabilirsiniz.
            </p>
          </div>
        ) : (
          files.map((file) => {
            const isImage = file.type.startsWith('image/');

            return (
              <div
                key={file.id}
                className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-xs"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    {getFileIcon(file.type)}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-slate-800 truncate" title={file.name}>
                      {file.name}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {formatFileSize(file.size)} · {file.uploadedBy}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {isImage && (
                    <button
                      onClick={() => onAddImageToCanvas(file.dataUrl, file.name)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium transition-colors"
                      title="Tuval Üzerine Ekle"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Tahtaya Ekle</span>
                    </button>
                  )}

                  <a
                    href={file.dataUrl}
                    download={file.name}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200"
                    title="İndir"
                  >
                    <Download className="w-4 h-4" />
                  </a>

                  <button
                    onClick={() => onDeleteFile(file.id)}
                    className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                    title="Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
