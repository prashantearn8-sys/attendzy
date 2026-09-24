import React, { useState } from 'react';
import {
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  X,
  ArrowRight,
  Globe,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';

interface AuthDiagnosticModalProps {
  errorMessage: string;
  onClose: () => void;
  onRetryPopup: () => void;
  onRetryRedirect: () => void;
}

export const AuthDiagnosticModal: React.FC<AuthDiagnosticModalProps> = ({
  errorMessage,
  onClose,
  onRetryPopup,
  onRetryRedirect,
}) => {
  const [copied, setCopied] = useState(false);
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'attendzy.netlify.app';

  const isDomainError = errorMessage.toLowerCase().includes('unauthorized domain') || errorMessage.toLowerCase().includes('auth/unauthorized-domain');
  const isAccessDenied = errorMessage.toLowerCase().includes('access_denied') || errorMessage.toLowerCase().includes('403');
  const isPopupBlocked = errorMessage.toLowerCase().includes('popup') || errorMessage.toLowerCase().includes('blocked');

  const copyHost = () => {
    navigator.clipboard.writeText(currentHost);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-gray-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-gray-900 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isDomainError
                ? 'bg-amber-100 text-amber-700'
                : isAccessDenied
                ? 'bg-rose-100 text-rose-700'
                : 'bg-blue-100 text-blue-700'
            }`}>
              {isDomainError ? (
                <Globe className="w-5 h-5" />
              ) : isAccessDenied ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                {isDomainError
                  ? 'Domain Not Authorized in Firebase'
                  : isAccessDenied
                  ? 'Google Sign-In Access Denied (Error 403)'
                  : isPopupBlocked
                  ? 'Sign-In Popup Blocked'
                  : 'Google Authentication Notice'}
              </h3>
              <p className="text-xs text-gray-500">Firebase &amp; Google Cloud troubleshooting</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Details Box */}
        <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-700 break-words max-h-32 overflow-y-auto">
          {errorMessage}
        </div>

        {/* Actionable Guidance based on error */}
        {isDomainError && (
          <div className="space-y-3 text-xs text-gray-600 bg-amber-50/60 border border-amber-200/80 p-4 rounded-xl">
            <p className="font-semibold text-amber-950">
              Your deployed domain is not registered under Firebase Authorized Domains:
            </p>
            <div className="flex items-center gap-2">
              <span className="font-mono bg-white px-2.5 py-1.5 rounded border border-amber-200 text-gray-900 font-semibold text-xs flex-1 truncate">
                {currentHost}
              </span>
              <button
                onClick={copyHost}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Domain'}</span>
              </button>
            </div>
            <ol className="list-decimal pl-4 space-y-1 text-[11px] text-amber-900">
              <li>Open <a href="https://console.firebase.google.com/project/gen-lang-client-0455461251/authentication/settings" target="_blank" rel="noopener noreferrer" className="font-bold underline inline-flex items-center gap-0.5">Firebase Console &gt; Auth Settings <ExternalLink className="w-3 h-3" /></a></li>
              <li>Scroll to <strong>Authorized domains</strong> and click <strong>Add domain</strong>.</li>
              <li>Paste <code className="font-bold">{currentHost}</code> and click <strong>Save</strong>.</li>
            </ol>
          </div>
        )}

        {isAccessDenied && (
          <div className="space-y-2.5 text-xs text-gray-600 bg-rose-50/60 border border-rose-200/80 p-4 rounded-xl">
            <p className="font-semibold text-rose-950">
              Your app is "In production", but Google is blocking login because sensitive scopes are still listed:
            </p>
            <ol className="list-decimal pl-4 space-y-1 text-[11px] text-rose-900">
              <li>
                Open <a href="https://console.cloud.google.com/apis/credentials/consent?project=gen-lang-client-0455461251" target="_blank" rel="noopener noreferrer" className="font-bold underline inline-flex items-center gap-0.5">OAuth Consent Screen <ExternalLink className="w-3 h-3" /></a>
              </li>
              <li>Click <strong>Edit App</strong> &gt; go to <strong>Scopes</strong> (Page 2).</li>
              <li>Under <strong>Sensitive Scopes</strong> (e.g. Sheets or Calendar), click <strong>Remove / Trash</strong> so only non-sensitive scopes remain (email, profile, openid).</li>
              <li>Save and exit. Since non-sensitive scopes require zero verification, sign-in works immediately!</li>
            </ol>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            onClick={() => {
              onClose();
              onRetryRedirect();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-gray-900 hover:bg-black text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all active:scale-98"
          >
            <span>Sign In with Full-Page Redirect (Recommended)</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onRetryPopup();
              }}
              className="flex-1 py-2 px-3 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
              <span>Retry Popup Sign-In</span>
            </button>
            <button
              onClick={onClose}
              className="py-2 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
