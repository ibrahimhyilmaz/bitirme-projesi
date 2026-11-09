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
  FileVideo,
  X,
  GripVertical,
  AlertCircle,
  Loader2,
  Eye,
} from 'lucide-react';
import { SharedFile } from '../types';
import {
  validateFile,
  validateVideoFileMetadata,
  createDocumentCardSvgDataUrl,
  createMarkdownCardSvgDataUrl,
  extractTextFromDataUrl,
  FILE_INPUT_ACCEPT,
} from '../utils/fileValidation';

interface FileShareModalProps {
  files: SharedFile[];
  onUploadFile: (fileData: { name: string; size: number; fileType: string; dataUrl: string }) => void;
  onDeleteFile: (fileId: string) => void;
  onAddImageToCanvas: (dataUrl: string, name: string, width?: number, height?: number) => void;
  onAddPdfToCanvas?: (pdfUrl: string, name: string) => void;
  onAddVideoToCanvas?: (videoUrl: string, name: string) => void;
  onClose: () => void;
}

function renderFormattedMarkdownPreview(mdText: string) {
  const lines = (mdText || '').replace(/\r\n/g, '\n').split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  lines.forEach((rawLine, idx) => {
    const trimmed = rawLine.trim();
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${idx}`}
            className="my-2.5 p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto"
          >
            <code>{codeLines.join('\n')}</code>
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      return;
    }

    if (!trimmed) {
      elements.push(<div key={`sp-${idx}`} className="h-2" />);
      return;
    }

    if (trimmed === '---' || trimmed === '***') {
      elements.push(<hr key={`hr-${idx}`} className="my-3 border-slate-200" />);
      return;
    }

    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={idx} className="text-lg font-extrabold text-slate-900 mt-3 mb-1.5">
          {trimmed.replace(/^#\s+/, '')}
        </h1>
      );
      return;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={idx} className="text-base font-bold text-slate-800 mt-2.5 mb-1">
          {trimmed.replace(/^##\s+/, '')}
        </h2>
      );
      return;
    }
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={idx} className="text-sm font-bold text-slate-800 mt-2 mb-1">
          {trimmed.replace(/^###\s+/, '')}
        </h3>
      );
      return;
    }
    if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote
          key={idx}
          className="border-l-4 border-indigo-500 pl-3 py-1 my-1.5 text-xs italic text-slate-600 bg-indigo-50/50 rounded-r-lg"
        >
          {trimmed.replace(/^>\s+/, '')}
        </blockquote>
      );
      return;
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const content = trimmed.replace(/^[-*]\s+/, '');
      elements.push(
        <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 my-1 pl-1">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1.5 shrink-0" />
          <span className="leading-relaxed">{content}</span>
        </div>
      );
      return;
    }

    elements.push(
      <p key={idx} className="text-xs text-slate-700 leading-relaxed my-1">
        {rawLine}
      </p>
    );
  });

  if (inCodeBlock && codeLines.length > 0) {
    elements.push(
      <pre
        key="code-eof"
        className="my-2.5 p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto"
      >
        <code>{codeLines.join('\n')}</code>
      </pre>
    );
  }

  return elements;
}

export const FileShareModal: React.FC<FileShareModalProps> = ({
  files,
  onUploadFile,
  onDeleteFile,
  onAddImageToCanvas,
  onAddPdfToCanvas,
  onAddVideoToCanvas,
  onClose,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [previewMarkdownFile, setPreviewMarkdownFile] = useState<{
    file: SharedFile;
    content: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setValidationError(null);
    const validation = validateFile(file.name, file.type, file.size);
    if (!validation.valid) {
      setValidationError(validation.error || 'Bu dosya türü desteklenmiyor.');
      return;
    }

    setIsProcessing(true);
    try {
      const videoCheck = await validateVideoFileMetadata(file);
      if (!videoCheck.valid) {
        setValidationError(videoCheck.error || 'Video süre veya boyut sınırını aşıyor.');
        setIsProcessing(false);
        return;
      }

      const lower = file.name.toLowerCase();
      const resolvedMime =
        file.type ||
        (lower.endsWith('.pdf')
          ? 'application/pdf'
          : lower.endsWith('.md') || lower.endsWith('.markdown')
          ? 'text/markdown'
          : lower.endsWith('.mp4')
          ? 'video/mp4'
          : lower.endsWith('.webm')
          ? 'video/webm'
          : lower.endsWith('.mov')
          ? 'video/quicktime'
          : 'application/octet-stream');

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        onUploadFile({
          name: file.name,
          size: file.size,
          fileType: resolvedMime,
          dataUrl,
        });
        setIsProcessing(false);
      };
      reader.onerror = () => {
        setValidationError('Dosya okunurken bir hata oluştu.');
        setIsProcessing(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setValidationError('Dosya işlenirken beklenmeyen bir hata oluştu.');
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void processFile(e.target.files[0]);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void processFile(e.dataTransfer.files[0]);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (file: SharedFile) => {
    const type = file.type || '';
    const name = file.name.toLowerCase();
    if (type.startsWith('video/') || name.endsWith('.mp4') || name.endsWith('.webm') || name.endsWith('.mov')) {
      return <FileVideo className="w-5 h-5 text-purple-600" />;
    }
    if (type.startsWith('image/')) return <FileImage className="w-5 h-5 text-blue-500" />;
    if (type === 'application/pdf' || name.endsWith('.pdf')) {
      return <FileText className="w-5 h-5 text-rose-500" />;
    }
    if (name.endsWith('.md') || name.endsWith('.markdown') || type.includes('markdown')) {
      return <FileText className="w-5 h-5 text-indigo-600" />;
    }
    if (name.endsWith('.doc') || name.endsWith('.docx')) {
      return <FileText className="w-5 h-5 text-blue-600" />;
    }
    if (name.endsWith('.ppt') || name.endsWith('.pptx')) {
      return <FileText className="w-5 h-5 text-amber-600" />;
    }
    if (name.endsWith('.xls') || name.endsWith('.xlsx') || name.endsWith('.csv')) {
      return <FileText className="w-5 h-5 text-emerald-600" />;
    }
    if (type.includes('text') || type.includes('json')) {
      return <FileText className="w-5 h-5 text-emerald-500" />;
    }
    return <File className="w-5 h-5 text-slate-500" />;
  };

  const handleAddMarkdownToBoard = (file: SharedFile) => {
    const mdText = extractTextFromDataUrl(file.dataUrl);
    const cardSvg = createMarkdownCardSvgDataUrl({
      name: file.name,
      size: file.size,
      markdownContent: mdText,
      uploadedBy: file.uploadedBy,
    });
    onAddImageToCanvas(cardSvg.dataUrl, file.name, cardSvg.width, cardSvg.height);
  };

  return (
    <>
      <div className="fixed top-16 right-4 bottom-6 w-[480px] max-w-[calc(100vw-32px)] z-40 bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden select-none cb-anim-scale-in">
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
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Validation Error Banner */}
        {validationError && (
          <div className="mx-4 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">Dosya Yüklenemedi</span>
              <p className="mt-0.5 text-rose-700 leading-relaxed">{validationError}</p>
            </div>
            <button
              onClick={() => setValidationError(null)}
              className="p-1 text-rose-500 hover:text-rose-700 rounded-md hover:bg-rose-100/50"
              title="Kapat"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Upload Drop Zone */}
        <div className="p-4 border-b border-slate-100">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50/50'
                : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={FILE_INPUT_ACCEPT}
              onChange={handleFileChange}
              className="hidden"
            />
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin mb-1.5" />
                <p className="text-xs font-semibold text-blue-700">
                  Dosya kontrol ediliyor ve optimize ediliyor...
                </p>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 text-slate-400 mb-1.5" />
                <p className="text-xs font-semibold text-slate-700">
                  Dosya yüklemek için tıklayın veya sürükleyip bırakın
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Markdown (.md), PDF, Word, PPTX, Excel, Görseller ve Videolar (Maks. 3 dk / 50 MB)
                </p>
                <span className="inline-block mt-1 text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                  Güvenlik: .exe ve çalıştırılabilir dosyalara izin verilmez
                </span>
              </>
            )}
          </div>
        </div>

        {/* Files List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {files.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-12">
              <FolderOpen className="w-10 h-10 stroke-1 mb-2 text-slate-300" />
              <p className="text-xs font-medium text-slate-600">Henüz dosya paylaşılmadı</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-[240px]">
                Odadaki üyelerle paylaşmak istediğiniz Markdown (.md), PDF, belge, görsel veya videoları buraya ekleyip tahtaya taşıyabilirsiniz.
              </p>
            </div>
          ) : (
            files.map((file) => {
              const lower = file.name.toLowerCase();
              const isImage =
                file.type.startsWith('image/') ||
                /\.(png|jpe?g|gif|webp|svg|bmp)$/.test(lower);
              const isPdf =
                file.type === 'application/pdf' ||
                lower.endsWith('.pdf') ||
                file.dataUrl.startsWith('data:application/pdf');
              const isVideo =
                file.type.startsWith('video/') ||
                /\.(mp4|webm|mov|ogg)$/.test(lower) ||
                file.dataUrl.startsWith('data:video/');
              const isMarkdown =
                lower.endsWith('.md') ||
                lower.endsWith('.markdown') ||
                file.type.includes('markdown');
              const isOtherDoc = !isImage && !isPdf && !isVideo && !isMarkdown;

              return (
                <div
                  key={file.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      'application/json',
                      JSON.stringify({
                        type: 'collab-file',
                        file: {
                          id: file.id,
                          name: file.name,
                          size: file.size,
                          type: file.type,
                          dataUrl: file.dataUrl,
                        },
                      })
                    );
                    e.dataTransfer.setData('text/plain', file.name);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  className="group flex items-center justify-between p-2.5 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-slate-50 transition-all text-xs cursor-grab active:cursor-grabbing shadow-2xs"
                  title="Tuvale sürükleyip bırakabilirsiniz"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="text-slate-300 group-hover:text-slate-400 shrink-0">
                      <GripVertical className="w-3.5 h-3.5" />
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      {getFileIcon(file)}
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

                  <div
                    className="flex items-center gap-1.5 shrink-0 ml-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isMarkdown && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const content = extractTextFromDataUrl(file.dataUrl);
                            setPreviewMarkdownFile({ file, content });
                          }}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium transition-colors cursor-pointer"
                          title="Markdown Dosyasını Tam Ekran Önizle"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Önizle</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddMarkdownToBoard(file);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium transition-colors cursor-pointer"
                          title="Biçimlendirilmiş Markdown Kartı Olarak Tahtaya Ekle"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Tahtaya Ekle</span>
                        </button>
                      </>
                    )}

                    {isImage && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddImageToCanvas(file.dataUrl, file.name);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium transition-colors cursor-pointer"
                        title="Tuval Üzerine Ekle"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Tahtaya Ekle</span>
                      </button>
                    )}

                    {isPdf && onAddPdfToCanvas && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddPdfToCanvas(file.dataUrl, file.name);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 font-medium transition-colors cursor-pointer"
                        title="PDF'i Tahtaya Ekle"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Tahtaya Ekle</span>
                      </button>
                    )}

                    {isVideo && onAddVideoToCanvas && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddVideoToCanvas(file.dataUrl, file.name);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 font-medium transition-colors cursor-pointer"
                        title="Videoyu Tahtaya Ekle (Oynatıcı ile)"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Tahtaya Ekle</span>
                      </button>
                    )}

                    {isOtherDoc && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const cardSvg = createDocumentCardSvgDataUrl({
                            name: file.name,
                            size: file.size,
                            type: file.type,
                          });
                          onAddImageToCanvas(cardSvg.dataUrl, file.name, cardSvg.width, cardSvg.height);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium transition-colors cursor-pointer"
                        title="Belge Kartı Olarak Tahtaya Ekle"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Tahtaya Ekle</span>
                      </button>
                    )}

                    <a
                      href={file.dataUrl}
                      download={file.name}
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors"
                      title="İndir"
                    >
                      <Download className="w-4 h-4" />
                    </a>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFile(file.id);
                      }}
                      className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
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

        {/* Footer hint */}
        <div className="bg-slate-50/80 px-4 py-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>İpucu: Markdown (.md), görsel, PDF ve videoları tahtaya sürükleyebilirsiniz.</span>
        </div>
      </div>

      {/* Full-Screen Formatted Markdown Preview Modal */}
      {previewMarkdownFile && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 select-none cb-anim-fade-in"
          onClick={() => setPreviewMarkdownFile(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden cb-anim-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="px-2 py-1 rounded-md bg-indigo-600 text-white text-[10px] font-extrabold tracking-wider">
                  .MD
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 truncate">
                    {previewMarkdownFile.file.name}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Markdown Doküman Önizlemesi · {formatFileSize(previewMarkdownFile.file.size)} ·{' '}
                    {previewMarkdownFile.file.uploadedBy}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    handleAddMarkdownToBoard(previewMarkdownFile.file);
                    setPreviewMarkdownFile(null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Doküman Kartı Olarak Tahtaya Ekle</span>
                </button>
                <button
                  onClick={() => setPreviewMarkdownFile(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-white select-text">
              {renderFormattedMarkdownPreview(previewMarkdownFile.content)}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
