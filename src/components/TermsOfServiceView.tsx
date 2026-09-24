import React from 'react';
import {
  FileText,
  ArrowLeft,
  ExternalLink,
  Shield,
  HelpCircle,
  Mail,
} from 'lucide-react';

interface TermsOfServiceViewProps {
  onBack?: () => void;
}

export const TermsOfServiceView: React.FC<TermsOfServiceViewProps> = ({ onBack }) => {
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-4">
        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4 text-gray-500" />
            <span>Back to Dashboard</span>
          </button>
        )}
        <div className="flex items-center gap-2 text-xs text-gray-500 ml-auto">
          <span>Effective: Sept 24, 2026</span>
          <span>•</span>
          <a
            href="/terms.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-gray-700 hover:text-black font-semibold"
          >
            <span>Direct Link (HTML)</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-10 shadow-sm space-y-8">
        {/* Title & Badge */}
        <div className="space-y-3 pb-6 border-b border-gray-100">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 border border-gray-200 text-gray-800 text-xs font-bold uppercase tracking-wider">
            <FileText className="w-4 h-4 text-gray-700" />
            <span>Terms of Service</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            Terms of Service
          </h1>
          <p className="text-sm text-gray-600 max-w-2xl leading-relaxed">
            By using Attendzy, you agree to these Terms. Please read them carefully.
          </p>
        </div>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-gray-900">1. Acceptance & Purpose</h2>
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
            Attendzy is a personal productivity assistant designed to help students track class attendance and timetable schedules. It is provided for personal tracking purposes and does not replace official university or college attendance rosters.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-gray-900">2. User Responsibilities</h2>
          <ul className="space-y-1.5 text-xs sm:text-sm text-gray-600 pl-4 list-disc">
            <li>You agree to use Attendzy only for lawful educational purposes.</li>
            <li>You are responsible for keeping your login credentials secure.</li>
            <li>You agree not to disrupt or reverse engineer the service infrastructure.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-gray-900">3. Disclaimer of Warranties</h2>
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
            Attendzy is provided "AS IS". While our algorithms calculate exact percentages and bunk safety margins according to your inputs, users should always cross-reference official institution records.
          </p>
        </section>

        <section className="space-y-2 pt-4 border-t border-gray-100">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-4 h-4 text-gray-600" />
            <span>Contact</span>
          </h2>
          <p className="text-xs sm:text-sm text-gray-600">
            For support or questions regarding these terms, email <a href="mailto:burnster1826@gmail.com" className="text-blue-600 font-semibold underline">burnster1826@gmail.com</a>.
          </p>
        </section>
      </div>
    </div>
  );
};
