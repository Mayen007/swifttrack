import React, { useState, useEffect, useRef } from 'react';
import { HelpCircle, AlertCircle, X, Check } from 'lucide-react';

export function PromptModal({
  isOpen,
  title = 'Input Required',
  message,
  inputLabel = 'Details / Reason',
  placeholder = 'Type here...',
  defaultValue = '',
  presets = [],
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  required = true,
  multiline = false,
  onConfirm,
  onClose,
}) {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue || '');
      setError('');
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          if (typeof inputRef.current.select === 'function') {
            inputRef.current.select();
          }
        }
      }, 50);
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const trimmed = (value || '').trim();
    if (required && !trimmed) {
      setError('This field is required');
      if (inputRef.current) inputRef.current.focus();
      return;
    }
    onConfirm(trimmed);
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Enter' && multiline && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-[#121622] border border-[#2a3447] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-modal-title"
      >
        {/* Header */}
        <div className="p-5 flex items-start gap-3.5 border-b border-[#222834]">
          <div className={`p-2.5 rounded-xl border shrink-0 ${
            isDestructive 
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' 
              : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
          }`}>
            {isDestructive ? <AlertCircle className="w-5 h-5" /> : <HelpCircle className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="prompt-modal-title" className="text-base font-bold text-white tracking-wide">
              {title}
            </h3>
            {message && (
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {message}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-3.5">
            {/* Quick preset chips */}
            {presets && presets.length > 0 && (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Suggested Reasons
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {presets.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setValue(preset);
                        setError('');
                        if (inputRef.current) inputRef.current.focus();
                      }}
                      className={`px-2.5 py-1 text-xs rounded-md border transition-all cursor-pointer ${
                        value === preset
                          ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-semibold shadow-sm'
                          : 'bg-[#181e2b] border-[#2b3548] text-slate-300 hover:bg-[#202738] hover:text-white'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                {inputLabel} {required && <span className="text-rose-400">*</span>}
              </label>
              {multiline ? (
                <textarea
                  ref={inputRef}
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    if (error) setError('');
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  rows={3}
                  className={`w-full px-3 py-2 bg-[#181e2b] border rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none transition-colors resize-none ${
                    error ? 'border-rose-500 focus:border-rose-400' : 'border-[#2d3748] focus:border-blue-500'
                  }`}
                />
              ) : (
                <input
                  ref={inputRef}
                  type="text"
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    if (error) setError('');
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  className={`w-full px-3 py-2 bg-[#181e2b] border rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${
                    error ? 'border-rose-500 focus:border-rose-400' : 'border-[#2d3748] focus:border-blue-500'
                  }`}
                />
              )}
              {error && (
                <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {error}
                </p>
              )}
              {multiline && (
                <p className="text-[10px] text-slate-500 mt-1">Press Ctrl+Enter to submit</p>
              )}
            </div>
          </div>

          {/* Footer Controls */}
          <div className="px-5 py-3.5 bg-[#161c28] border-t border-[#222834] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              {cancelText}
            </button>
            <button
              type="submit"
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md flex items-center gap-1.5 ${
                isDestructive
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              {confirmText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
