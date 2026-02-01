import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'MCPForge privacy policy — how we collect, use, and protect your data.',
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-gray-400 mb-10 text-sm">Last updated: June 28, 2025</p>

      <div className="prose prose-invert prose-gray max-w-none space-y-8 text-gray-300 text-[15px] leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-white mb-3">1. Introduction</h2>
          <p>
            Claudius Inc. (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates MCPForge
            (the &quot;Service&quot;), accessible at{' '}
            <a href="https://mcpforge.dev" className="text-forge-400 hover:underline">mcpforge.dev</a>.
            This Privacy Policy explains how we collect, use, disclose, and safeguard your
            information when you use our Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">2. Information We Collect</h2>

          <h3 className="text-lg font-medium text-gray-200 mt-4 mb-2">Account Information</h3>
          <p>
            When you sign in via GitHub OAuth, we receive your GitHub username, email address,
            profile avatar URL, and GitHub user ID. We store this information to provide your
            account and personalize the Service.
          </p>

          <h3 className="text-lg font-medium text-gray-200 mt-4 mb-2">Usage Data</h3>
          <p>
            We automatically collect information about how you interact with the Service, including
            pages visited, features used, generation requests, browser type, operating system,
            referring URLs, and timestamps. This data is collected via Vercel Analytics and Vercel
            Speed Insights.
          </p>

          <h3 className="text-lg font-medium text-gray-200 mt-4 mb-2">API Specs &amp; Generated Code</h3>
          <p>
            When you use the code generation features, we process the OpenAPI specifications,
            API documentation, or natural language descriptions you provide. Generated server code
            may be temporarily stored to enable downloads and history features.
          </p>

          <h3 className="text-lg font-medium text-gray-200 mt-4 mb-2">Billing Information</h3>
          <p>
            Payment processing is handled by Stripe. We do not store your full credit card number.
            Stripe may collect payment information in accordance with their{' '}
            <a href="https://stripe.com/privacy" className="text-forge-400 hover:underline" target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </a>.
            We store your Stripe customer ID and subscription status.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">3. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Provide, operate, and maintain the Service</li>
            <li>Process your code generation requests</li>
            <li>Manage your account and subscription</li>
            <li>Send transactional communications (e.g., billing receipts)</li>
            <li>Analyze usage to improve the Service</li>
            <li>Detect and prevent fraud or abuse</li>
            <li>Comply with legal obligations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">4. Third-Party Services</h2>
          <p>We use the following third-party services that may process your data:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>GitHub</strong> — OAuth authentication</li>
            <li><strong>Stripe</strong> — payment processing and subscription management</li>
            <li><strong>Vercel</strong> — hosting, analytics, and speed insights</li>
            <li><strong>Turso (libSQL)</strong> — database storage</li>
            <li><strong>OpenAI</strong> — AI-powered code generation</li>
          </ul>
          <p className="mt-2">
            Each third-party service operates under its own privacy policy. We encourage you to
            review their respective policies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">5. Cookies &amp; Tracking</h2>
          <p>
            We use cookies for essential functionality, including session management and
            authentication. Vercel Analytics uses privacy-friendly, cookie-less analytics.
            We do not use third-party advertising cookies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">6. Data Retention</h2>
          <p>
            We retain your account data for as long as your account is active. Generated code and
            generation history may be retained for up to 90 days after creation. You may request
            deletion of your account and associated data at any time by contacting us.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">7. Data Security</h2>
          <p>
            We implement industry-standard security measures to protect your data, including
            encryption in transit (TLS), secure authentication flows, and access controls.
            However, no method of transmission over the Internet is 100% secure.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">8. Your Rights</h2>
          <p>Depending on your jurisdiction, you may have the right to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Object to or restrict certain processing</li>
            <li>Data portability</li>
            <li>Withdraw consent (where processing is based on consent)</li>
          </ul>
          <p className="mt-2">
            To exercise any of these rights, contact us at the email below.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">9. Children&apos;s Privacy</h2>
          <p>
            The Service is not directed to individuals under 16. We do not knowingly collect
            personal information from children. If you believe we have inadvertently collected
            such data, please contact us for removal.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of material
            changes by updating the &quot;Last updated&quot; date and, where appropriate, by
            posting a notice on the Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">11. Contact</h2>
          <p>
            If you have questions about this Privacy Policy, contact Claudius Inc. at:{' '}
            <a href="mailto:privacy@mcpforge.dev" className="text-forge-400 hover:underline">
              privacy@mcpforge.dev
            </a>
          </p>
        </section>
      </div>

      <footer className="mt-16 pt-8 border-t border-gray-800 text-center text-sm text-gray-500">
        <a href="/terms" className="text-gray-400 hover:text-white mr-6">Terms of Service</a>
        <a href="/" className="text-gray-400 hover:text-white">Back to MCPForge</a>
      </footer>
    </div>
  );
}
