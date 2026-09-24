import React from 'react';
import {
  ShieldCheck,
  Lock,
  Database,
  EyeOff,
  UserCheck,
  Mail,
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';

interface PrivacyPolicyViewProps {
  onBack?: () => void;
}

export const PrivacyPolicyView: React.FC<PrivacyPolicyViewProps> = ({ onBack }) => {
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
            href="/privacy.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-semibold"
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Privacy & Data Protection</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-sm text-gray-600 max-w-2xl leading-relaxed">
            Attendzy ("we", "us", or "our") is designed to give students complete control and visibility over their academic attendance. This policy details how we treat your personal information.
          </p>
        </div>

        {/* Highlights Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2">
              <EyeOff className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-gray-900">Zero Advertising</h4>
            <p className="text-[11px] text-gray-500 leading-snug">
              We do not show ads, sell user data, or share personal info with data brokers.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-1">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-2">
              <Lock className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-gray-900">Encrypted in Firestore</h4>
            <p className="text-[11px] text-gray-500 leading-snug">
              Your attendance records are secured with TLS encryption and user-level Firebase rules.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-1">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center mb-2">
              <UserCheck className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-gray-900">Full Data Ownership</h4>
            <p className="text-[11px] text-gray-500 leading-snug">
              Delete subjects or clear your entire history at any time with a single click.
            </p>
          </div>
        </div>

        {/* Section 1: Information Collected */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-gray-900 text-white text-xs flex items-center justify-center font-mono">1</span>
            <span>Information We Collect</span>
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
            We only collect the minimal information necessary to deliver student attendance analytics:
          </p>
          <ul className="space-y-2 text-xs sm:text-sm text-gray-600 pl-4 list-disc">
            <li>
              <strong className="text-gray-900">Google Account Profile:</strong> When you sign in with Google, we receive your name, email address, and profile photo avatar from Firebase Authentication to create and protect your account session.
            </li>
            <li>
              <strong className="text-gray-900">Academic & Timetable Data:</strong> Subjects, schedules, timeslots, room numbers, and minimum target attendance percentage goals set by you.
            </li>
            <li>
              <strong className="text-gray-900">Attendance Marks & Logs:</strong> Status records (Present, Absent, Excused, Cancelled) and class notes.
            </li>
            <li>
              <strong className="text-gray-900">Timetable Images:</strong> If you upload a timetable schedule picture, it is processed locally/via Google Vision for schedule extraction and is not retained or shared externally.
            </li>
          </ul>
        </section>

        {/* Section 2: How We Use Your Data */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-gray-900 text-white text-xs flex items-center justify-center font-mono">2</span>
            <span>How We Use Your Information</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-gray-600">
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>Calculate overall and individual subject attendance percentages.</span>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>Compute safe bunk margins and classes required to meet targets.</span>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>Synchronize your attendance records across your devices.</span>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>Authenticate your session and safeguard your private data.</span>
            </div>
          </div>
        </section>

        {/* Section 3: Google Limited Use Compliance */}
        <section className="space-y-3 bg-emerald-50/50 border border-emerald-200/80 p-5 rounded-2xl">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span>Google API User Data & Limited Use Policy</span>
          </h2>
          <p className="text-xs sm:text-sm text-emerald-950 leading-relaxed">
            Attendzy complies with the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="font-semibold underline">Google API Services User Data Policy</a>, including the Limited Use requirements:
          </p>
          <ul className="space-y-1.5 text-xs text-emerald-900 pl-4 list-disc">
            <li>We request only non-sensitive standard identity scopes (email, profile, openid).</li>
            <li>We do NOT transfer Google user data to advertising networks or external data brokers.</li>
            <li>We do NOT use Google user data to serve ads.</li>
            <li>We do NOT use Google user data to train AI/ML models.</li>
          </ul>
        </section>

        {/* Section 4: Data Retention & Deletion */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-gray-900 text-white text-xs flex items-center justify-center font-mono">3</span>
            <span>Data Retention & Deletion Rights</span>
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
            You retain absolute ownership of your data. You can delete your records at any time:
          </p>
          <div className="space-y-2 text-xs sm:text-sm text-gray-600">
            <p>
              • <strong>One-Click In-App Deletion:</strong> Go to <em>Settings &gt; Clear All Data</em> to permanently remove all subjects, timetables, and attendance marks from Firestore.
            </p>
            <p>
              • <strong>Account Removal:</strong> You may request complete account deletion by emailing us at <a href="mailto:burnster1826@gmail.com" className="text-blue-600 font-semibold underline">burnster1826@gmail.com</a>. We will wipe all database documents within 48 hours.
            </p>
          </div>
        </section>

        {/* Section 5: Developer Contact */}
        <section className="space-y-3 pt-4 border-t border-gray-100">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-5 h-5 text-gray-700" />
            <span>Contact & Support</span>
          </h2>
          <p className="text-xs sm:text-sm text-gray-600">
            If you have questions regarding this policy or your personal attendance records:
          </p>
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs space-y-1 font-mono">
            <p><strong>App:</strong> Attendzy (Student Attendance Tracker)</p>
            <p><strong>URL:</strong> https://attendzy.netlify.app</p>
            <p><strong>Privacy Contact:</strong> burnster1826@gmail.com</p>
          </div>
        </section>
      </div>
    </div>
  );
};
