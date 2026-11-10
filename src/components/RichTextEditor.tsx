import { useEffect, useRef } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Label } from "@/components/ui/label";
import AIFieldButton from "@/components/AIFieldButton";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  required?: boolean;
  id: string;
  onAIGenerate?: () => Promise<void>;
  aiTooltip?: string;
  aiDisabled?: boolean;
  aiDisabledReason?: string;
  aiRemainingCredits?: number;
  aiIsLimitReached?: boolean;
}

const RichTextEditor = ({ 
  value, 
  onChange, 
  label, 
  placeholder = "Enter text...",
  required = false,
  id,
  onAIGenerate,
  aiTooltip = "Generate with AI",
  aiDisabled = false,
  aiDisabledReason,
  aiRemainingCredits,
  aiIsLimitReached = false
}: RichTextEditorProps) => {
  const quillRef = useRef<ReactQuill>(null);

  // Custom toolbar configuration with rich formatting options
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      [{ 'font': [] }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'align': [] }],
      ['link'],
      ['clean']
    ]
  };

  const formats = [
    'header', 'font', 'size',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'list', 'bullet',
    'align',
    'link'
  ];

  return (
    <div className="space-y-2 rich-text-editor-wrapper">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>
          {label} {required && <span className="text-foreground font-semibold">*</span>}
        </Label>
        {onAIGenerate && (
          <AIFieldButton 
            onClick={onAIGenerate} 
            tooltip={aiTooltip}
            disabled={aiDisabled}
            disabledReason={aiDisabledReason}
            remainingCredits={aiRemainingCredits}
            isLimitReached={aiIsLimitReached}
          />
        )}
      </div>
      <div className="border border-input rounded-xl overflow-hidden bg-background">
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={value}
          onChange={onChange}
          modules={modules}
          formats={formats}
          placeholder={placeholder}
          className="quill-editor"
        />
      </div>
      <style>{`
        .rich-text-editor-wrapper .quill-editor {
          min-height: 200px;
        }
        
        .rich-text-editor-wrapper .ql-container {
          font-size: 14px;
          min-height: 200px;
          max-height: 400px;
          overflow-y: auto;
        }
        
        .rich-text-editor-wrapper .ql-editor {
          min-height: 200px;
          padding: 12px 15px;
        }
        
        .rich-text-editor-wrapper .ql-editor.ql-blank::before {
          color: hsl(var(--muted-foreground));
          font-style: normal;
        }
        
        .rich-text-editor-wrapper .ql-toolbar {
          border: none;
          border-bottom: 1px solid hsl(var(--border));
          background: hsl(var(--muted) / 0.3);
          padding: 8px;
        }
        
        .rich-text-editor-wrapper .ql-stroke {
          stroke: hsl(var(--foreground));
        }
        
        .rich-text-editor-wrapper .ql-fill {
          fill: hsl(var(--foreground));
        }
        
        .rich-text-editor-wrapper .ql-picker-label {
          color: hsl(var(--foreground));
        }
        
        .rich-text-editor-wrapper .ql-toolbar button:hover,
        .rich-text-editor-wrapper .ql-toolbar button:focus,
        .rich-text-editor-wrapper .ql-toolbar button.ql-active {
          background: hsl(var(--primary) / 0.1);
          color: hsl(var(--primary));
        }
        
        .rich-text-editor-wrapper .ql-toolbar button:hover .ql-stroke,
        .rich-text-editor-wrapper .ql-toolbar button.ql-active .ql-stroke {
          stroke: hsl(var(--primary));
        }
        
        .rich-text-editor-wrapper .ql-toolbar button:hover .ql-fill,
        .rich-text-editor-wrapper .ql-toolbar button.ql-active .ql-fill {
          fill: hsl(var(--primary));
        }
        
        /* Dropdown picker options - reduce heading sizes */
        .rich-text-editor-wrapper .ql-picker-options .ql-picker-item[data-value="1"]::before {
          font-size: 1.2em !important;
        }
        
        .rich-text-editor-wrapper .ql-picker-options .ql-picker-item[data-value="2"]::before {
          font-size: 1.1em !important;
        }
        
        .rich-text-editor-wrapper .ql-picker-options .ql-picker-item[data-value="3"]::before {
          font-size: 1em !important;
        }
        
        /* Enhanced editor content styles */
        .rich-text-editor-wrapper .ql-editor h1 {
          font-size: 2em;
          font-weight: bold;
          margin-bottom: 0.5em;
        }
        
        .rich-text-editor-wrapper .ql-editor h2 {
          font-size: 1.5em;
          font-weight: bold;
          margin-bottom: 0.5em;
        }
        
        .rich-text-editor-wrapper .ql-editor h3 {
          font-size: 1.25em;
          font-weight: bold;
          margin-bottom: 0.5em;
        }
        
        .rich-text-editor-wrapper .ql-editor ul,
        .rich-text-editor-wrapper .ql-editor ol {
          padding-left: 1.5em;
          margin-bottom: 0.5em;
        }
        
        .rich-text-editor-wrapper .ql-editor a {
          color: hsl(var(--primary));
          text-decoration: underline;
        }
        
        .rich-text-editor-wrapper .ql-editor strong {
          font-weight: bold;
        }
        
        .rich-text-editor-wrapper .ql-editor em {
          font-style: italic;
        }
        
        /* Dark mode support */
        .dark .rich-text-editor-wrapper .ql-editor.ql-blank::before {
          color: hsl(var(--muted-foreground));
        }
        
        /* Scrollbar styling */
        .rich-text-editor-wrapper .ql-container::-webkit-scrollbar {
          width: 8px;
        }
        
        .rich-text-editor-wrapper .ql-container::-webkit-scrollbar-track {
          background: hsl(var(--muted) / 0.3);
        }
        
        .rich-text-editor-wrapper .ql-container::-webkit-scrollbar-thumb {
          background: hsl(var(--muted-foreground) / 0.3);
          border-radius: 4px;
        }
        
        .rich-text-editor-wrapper .ql-container::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--muted-foreground) / 0.5);
        }
      `}</style>
    </div>
  );
};

export default RichTextEditor;
