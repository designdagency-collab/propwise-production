import React from 'react';

interface TermsAndConditionsProps {
  onBack: () => void;
}

const TermsAndConditions: React.FC<TermsAndConditionsProps> = ({ onBack }) => {
  const lastUpdated = new Date().toLocaleDateString('en-AU', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-32">
        <div className="mb-12">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-medium hover:text-[#C9A961] transition-colors mb-8"
            style={{ color: 'var(--text-muted)' }}
          >
            <i className="fa-solid fa-arrow-left"></i>
            Back to Home
          </button>
          
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tighter mb-4" style={{ color: 'var(--text-primary)' }}>
            Terms & Conditions
          </h1>
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            Last updated: {lastUpdated}
          </p>
        </div>

        <div className="prose prose-slate max-w-none space-y-8" style={{ color: 'var(--text-primary)' }}>
          
          {/* Section 1 */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>1. About the Service</h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              BlockCheck.ai (referred to as "we", "us", or "our") provides automated property intelligence, analysis, and indicative insights based on publicly available data sources, third-party information, and algorithmic interpretation.
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              The service is designed to assist users in understanding property characteristics, zoning context, development feasibility, and potential value considerations. <strong>It does not replace professional advice.</strong>
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>2. No Professional Advice</h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              The information provided through BlockCheck.ai:
            </p>
            <ul className="list-disc list-inside text-sm space-y-1 ml-4" style={{ color: 'var(--text-secondary)' }}>
              <li>Is general information only</li>
              <li>Is <strong>not</strong> financial advice</li>
              <li>Is <strong>not</strong> legal advice</li>
              <li>Is <strong>not</strong> town planning advice</li>
              <li>Is <strong>not</strong> valuation advice</li>
            </ul>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              You must not rely on the Service as a substitute for advice from licensed professionals, including but not limited to:
            </p>
            <ul className="list-disc list-inside text-sm space-y-1 ml-4" style={{ color: 'var(--text-secondary)' }}>
              <li>Property valuers</li>
              <li>Town planners</li>
              <li>Surveyors</li>
              <li>Architects</li>
              <li>Solicitors</li>
              <li>Financial advisers</li>
            </ul>
            <p className="text-sm leading-relaxed font-medium" style={{ color: 'var(--text-primary)' }}>
              You are solely responsible for obtaining independent professional advice before making any property, financial, or legal decision.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>3. Accuracy of Information</h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              While we take reasonable steps to source data from reputable and current sources, we do not guarantee that:
            </p>
            <ul className="list-disc list-inside text-sm space-y-1 ml-4" style={{ color: 'var(--text-secondary)' }}>
              <li>Information is complete</li>
              <li>Information is current</li>
              <li>Information is accurate</li>
              <li>Information reflects council-specific interpretations</li>
              <li>Zoning or planning rules will be applied consistently</li>
            </ul>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Planning controls, zoning rules, and development pathways vary by council and may change without notice.
            </p>
            <p className="text-sm leading-relaxed font-medium" style={{ color: 'var(--text-primary)' }}>
              All estimates, projections, costs, and value figures are indicative only.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>4. Planning, Zoning & Development Information</h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Any references to:
            </p>
            <ul className="list-disc list-inside text-sm space-y-1 ml-4" style={{ color: 'var(--text-secondary)' }}>
              <li>Zoning codes</li>
              <li>Planning pathways (Exempt / CDC / DA)</li>
              <li>Development feasibility</li>
              <li>Potential rezoning</li>
              <li>Highest & best use</li>
              <li>Development scenarios</li>
            </ul>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              are <strong>indicative interpretations</strong>, not approvals or confirmations.
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Final determinations can only be made by:
            </p>
            <ul className="list-disc list-inside text-sm space-y-1 ml-4" style={{ color: 'var(--text-secondary)' }}>
              <li>Local councils</li>
              <li>State planning authorities</li>
              <li>Accredited certifiers</li>
              <li>Licensed planning professionals</li>
            </ul>
            <p className="text-sm leading-relaxed font-medium" style={{ color: 'var(--text-primary)' }}>
              BlockCheck.ai does not lodge applications, provide approvals, or guarantee outcomes.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>5. Value Estimates & Uplift Projections</h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Any references to current value, after-improvement value, potential uplift, development end value, or indicative net outcomes are:
            </p>
            <ul className="list-disc list-inside text-sm space-y-1 ml-4" style={{ color: 'var(--text-secondary)' }}>
              <li>Estimates only</li>
              <li>Based on assumptions</li>
              <li>Subject to market conditions</li>
              <li>Subject to build quality, timing, approvals, and demand</li>
            </ul>
            <p className="text-sm leading-relaxed font-medium" style={{ color: 'var(--text-primary)' }}>
              Actual results may differ materially.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>6. Comparable Sales Data</h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Comparable sales information is provided for context only. Comparable sales:
            </p>
            <ul className="list-disc list-inside text-sm space-y-1 ml-4" style={{ color: 'var(--text-secondary)' }}>
              <li>May not be directly comparable</li>
              <li>May include assumptions</li>
              <li>May exclude off-market or unreported transactions</li>
            </ul>
            <p className="text-sm leading-relaxed font-medium" style={{ color: 'var(--text-primary)' }}>
              You should verify all sales data independently before relying on it.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>7. User Responsibility</h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              By using the Service, you acknowledge and agree that:
            </p>
            <ul className="list-disc list-inside text-sm space-y-1 ml-4" style={{ color: 'var(--text-secondary)' }}>
              <li>You are responsible for how you use the information</li>
              <li>You make decisions at your own risk</li>
              <li>You will independently verify critical information</li>
              <li>You will not rely solely on BlockCheck.ai to make financial or legal decisions</li>
            </ul>
          </section>

          {/* Section 8 */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>8. Limitation of Liability</h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              To the maximum extent permitted by Australian law, BlockCheck.ai, its operators, directors, employees, and affiliates will not be liable for any loss, damage, cost, or expense arising from:
            </p>
            <ul className="list-disc list-inside text-sm space-y-1 ml-4" style={{ color: 'var(--text-secondary)' }}>
              <li>Reliance on information provided</li>
              <li>Errors or omissions</li>
              <li>Planning or zoning interpretations</li>
              <li>Financial loss</li>
              <li>Loss of opportunity</li>
              <li>Construction or development outcomes</li>
              <li>Council decisions</li>
              <li>Market movements</li>
            </ul>
            <p className="text-sm leading-relaxed font-medium" style={{ color: 'var(--text-primary)' }}>
              Use of the Service is entirely at your own risk.
            </p>
          </section>

          {/* Section 9 */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>9. Subscription & Payments</h2>
            <ul className="list-disc list-inside text-sm space-y-1 ml-4" style={{ color: 'var(--text-secondary)' }}>
              <li>Subscriptions are billed in advance</li>
              <li>Prices are in Australian Dollars (AUD)</li>
              <li>You may cancel at any time</li>
              <li>No refunds for partially used billing periods</li>
              <li>Usage limits may apply depending on plan</li>
            </ul>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              We reserve the right to change pricing or features with reasonable notice.
            </p>
          </section>

          {/* Section 10 */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>10. Fair Use</h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Unlimited or high-volume plans are subject to fair use. We may restrict access if usage appears abusive, automated, or outside intended personal or professional use.
            </p>
          </section>

          {/* Section 11 */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>11. Intellectual Property</h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              All content, branding, data structure, analysis logic, and presentation are the intellectual property of BlockCheck.ai.
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              You may not copy, resell, scrape, repackage, or redistribute the Service or its outputs without written permission.
            </p>
          </section>

          {/* Section 12 */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>12. Changes to the Service</h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              We may modify, suspend, or discontinue any part of the Service at any time, with or without notice.
            </p>
          </section>

          {/* Section 13 */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>13. Governing Law</h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              These Terms are governed by the laws of Australia. Any disputes will be subject to the jurisdiction of Australian courts.
            </p>
          </section>

        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t" style={{ borderColor: 'var(--border-color)' }}>
          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} BlockCheck.ai. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TermsAndConditions;

