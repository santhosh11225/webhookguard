import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowRight } from 'lucide-react';
import { Button } from '../components/common/Button';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-xl w-full text-center space-y-6 bg-white border border-gray-200 p-8 sm:p-10 rounded-lg">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded bg-blue-50 text-blue-600 border border-blue-200 mx-auto">
          <Shield className="w-6 h-6" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#333333] tracking-tight">
            WebhookGuard
          </h1>
          <p className="text-base font-medium text-gray-700">
            Automated Webhook Testing & Reliability Engine
          </p>
        </div>

        <p className="text-sm text-gray-500 leading-relaxed max-w-md mx-auto">
          Test webhook endpoints for schema validity, retry resilience, and genuine HMAC-SHA256 signature verification.
        </p>

        <div className="pt-2">
          <Link to="/dashboard">
            <Button size="md" variant="primary" icon={<ArrowRight className="w-4 h-4" />}>
              Open Testing Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
