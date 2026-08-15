import React from 'react';
import { X, Shield, FileText } from 'lucide-react';

interface LegalModalProps {
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<LegalModalProps> = ({ onClose }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
    <div 
      className="relative w-full max-w-2xl max-h-[85vh] bg-zinc-950 border border-zinc-800 flex flex-col shadow-2xl"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between p-4 border-b border-zinc-900 bg-zinc-950/90 top-0 sticky z-10 hidden sm:flex">
         <div className="flex items-center space-x-3">
           <Shield className="w-5 h-5 text-red-500" />
           <h2 className="text-xl font-medium text-zinc-100 font-sans tracking-tight">Privacy Policy</h2>
         </div>
         <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white transition-colors bg-zinc-900 hover:bg-zinc-800 rounded-sm">
           <X className="w-5 h-5" />
         </button>
      </div>

      <div className="p-6 overflow-y-auto font-sans text-zinc-300 leading-relaxed space-y-6 text-sm">
        <h3 className="text-lg font-medium text-white mb-2">1. Information We Collect</h3>
        <p>
          We collect personal information that you voluntarily provide to us when you register on the Services. The personal information that we collect depends on the context of your interactions with us and the Services, the choices you make, and the products and features you use. The personal information we collect may include the following: email addresses and passwords. Passwords are cryptographically hashed and never stored in plain text.
        </p>

        <h3 className="text-lg font-medium text-white mb-2">2. How We Use Your Information</h3>
        <p>
          We process your information for purposes based on legitimate business interests, the fulfillment of our contract with you, compliance with our legal obligations, and/or your consent. This includes rendering personalized news feeds, account authentication, maintaining system health, and ensuring basic application functionality. We do not sell your personal data to third parties.
        </p>

        <h3 className="text-lg font-medium text-white mb-2">3. AI Data Processing & Editorial Reframing</h3>
        <p>
          Overlay Global Lens utilizes generative artificial intelligence (AI) models to analyze, summarize, and contextually reframe news content. When processing articles, no personally identifiable user data is transmitted to these AI models. The AI systems are solely used to analyze public text and provide cultural and historical lenses. We do not use user data to train our AI models.
        </p>

        <h3 className="text-lg font-medium text-white mb-2">4. Intellectual Property Rights</h3>
        <p>
          Unless otherwise indicated, the Services are our proprietary property and all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics on the Services (collectively, the "Content") and the trademarks, service marks, and logos contained therein are owned or controlled by us or licensed to us.
        </p>
      </div>
      
       {/* Mobile floating close button */}
      <button 
        onClick={onClose} 
        className="sm:hidden fixed bottom-6 right-6 p-4 bg-red-600 text-white rounded-full shadow-2xl flex items-center justify-center filter drop-shadow-[0_0_15px_rgba(220,38,38,0.5)] z-50 border border-red-500"
      >
        <X className="w-6 h-6" />
      </button>
    </div>
  </div>
);

export const TermsOfServiceModal: React.FC<LegalModalProps> = ({ onClose }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
    <div 
      className="relative w-full max-w-2xl max-h-[85vh] bg-zinc-950 border border-zinc-800 flex flex-col shadow-2xl"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between p-4 border-b border-zinc-900 bg-zinc-950/90 top-0 sticky z-10 hidden sm:flex">
         <div className="flex items-center space-x-3">
           <FileText className="w-5 h-5 text-red-500" />
           <h2 className="text-xl font-medium text-zinc-100 font-sans tracking-tight">Terms of Service</h2>
         </div>
         <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white transition-colors bg-zinc-900 hover:bg-zinc-800 rounded-sm">
           <X className="w-5 h-5" />
         </button>
      </div>

      <div className="p-6 overflow-y-auto font-sans text-zinc-300 leading-relaxed space-y-6 text-sm">
        <h3 className="text-lg font-medium text-white mb-2">1. Agreement to Terms</h3>
        <p>
          These Terms of Use constitute a legally binding agreement made between you, whether personally or on behalf of an entity ("you") and Overlay Global Lens ("Company," "we," "us," or "our"), concerning your access to and use of the application as well as any other media form, media channel, mobile website or mobile application related, linked, or otherwise connected thereto.
        </p>

        <h3 className="text-lg font-medium text-white mb-2">2. Information Accuracy</h3>
        <p>
          The content surfaced in this application may utilize automated context fetching and aggregation algorithms. We do not guarantee, represent or warrant that your use of our service will be uninterrupted, timely, secure or error-free. We do not warrant that the results that may be obtained from the use of the service will be accurate or reliable.
        </p>

        <h3 className="text-lg font-medium text-white mb-2">3. User Representations</h3>
        <p>
          By using the Service, you represent and warrant that: (1) all registration information you submit will be true, accurate, current, and complete; (2) you will maintain the accuracy of such information and promptly update such registration information as necessary; (3) you have the legal capacity and you agree to comply with these Terms of Use; (4) you are not a minor in the jurisdiction in which you reside; (5) you will not access the Service through automated or non-human means, whether through a bot, script or otherwise.
        </p>
      </div>

      {/* Mobile floating close button */}
      <button 
        onClick={onClose} 
        className="sm:hidden fixed bottom-6 right-6 p-4 bg-red-600 text-white rounded-full shadow-2xl flex items-center justify-center filter drop-shadow-[0_0_15px_rgba(220,38,38,0.5)] z-50 border border-red-500"
      >
        <X className="w-6 h-6" />
      </button>
    </div>
  </div>
);
