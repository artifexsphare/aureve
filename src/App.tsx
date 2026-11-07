/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LayoutShell } from './components/LayoutShell';
import { RunwayPage } from './components/RunwayPage';
import { StoreProvider } from './context/StoreContext';
import { HomePage } from './pages/HomePage';
import {
  AboutPage,
  AccountPage,
  AuthPage,
  ContactPage,
  PolicyDocumentPage,
} from './pages/AccountAndStaticPages';
import { AdminDashboardPage } from './pages/AdminDashboard';
import {
  CartPage,
  CheckoutPage,
  OrderSuccessPage,
  TrackOrderPage,
  WishlistPage,
} from './pages/CheckoutPages';
import {
  CategoriesPage,
  ComparePage,
  LookbookGridPage,
  ProductDetailPage,
  ShopPage,
} from './pages/ShopPages';

export default function App() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <LayoutShell>
          <Routes>
            {/* Complete AUREVÉ Luxury Fashion Storefront Homepage */}
            <Route path="/" element={<HomePage />} />
            <Route path="/runway" element={<RunwayPage />} />

            {/* Complete Shopping System */}
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/lookbook" element={<LookbookGridPage />} />
            <Route path="/product/:slug" element={<ProductDetailPage />} />
            <Route path="/compare" element={<ComparePage />} />

            {/* Persistent Bag, Wishlist, Checkout & Tracking */}
            <Route path="/cart" element={<CartPage />} />
            <Route path="/wishlist" element={<WishlistPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/order-success/:orderNumber" element={<OrderSuccessPage />} />
            <Route path="/track-order" element={<TrackOrderPage />} />

            {/* Customer Auth & Account */}
            <Route path="/login" element={<AuthPage initialMode="login" />} />
            <Route path="/register" element={<AuthPage initialMode="register" />} />
            <Route path="/account" element={<AccountPage initialTab="profile" />} />
            <Route path="/my-orders" element={<AccountPage initialTab="orders" />} />

            {/* Secure Administrator Command */}
            <Route path="/admin" element={<AdminDashboardPage />} />

            {/* Brand & Legal Policies */}
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route
              path="/faq"
              element={
                <PolicyDocumentPage
                  kicker="Client Guidance"
                  title="Frequently Asked Questions & Sizing"
                  sections={[
                    {
                      heading: 'How do French Couture sizes translate?',
                      body: 'FR 34 corresponds to XS (US 2 / UK 6), FR 36 to S (US 4 / UK 8), FR 38 to M (US 6 / UK 10), FR 40 to L (US 8 / UK 12), and FR 42 to XL.',
                    },
                    {
                      heading: 'Which payment methods are accepted in Pakistan?',
                      body: 'We support Cash on Delivery nationwide across Pakistan, international Visa/Mastercard via Stripe Hosted Checkout, and merchant architecture for Easypaisa and JazzCash.',
                    },
                    {
                      heading: 'How do I track my dispatch?',
                      body: 'Visit the Track Order page and enter your unique MV-XXXXXX order number generated at checkout.',
                    },
                  ]}
                />
              }
            />
            <Route
              path="/shipping-policy"
              element={
                <PolicyDocumentPage
                  kicker="Logistics & Courier"
                  title="Pakistan & International Shipping Policy"
                  sections={[
                    {
                      heading: 'Insured Express Courier Delivery (2–3 Business Days)',
                      body: 'All orders across Pakistan receive insured tamper-sealed atelier garment packaging at a flat delivery fee of Rs. 200.',
                    },
                  ]}
                />
              }
            />
            <Route
              path="/return-policy"
              element={
                <PolicyDocumentPage
                  kicker="Exchanges & Refunds"
                  title="Return & Exchange Policy"
                  sections={[
                    {
                      heading: '14-Day Complimentary Return Window',
                      body: 'Unworn pieces with original AUREVÉ security ribbons and dust bags attached may be returned or exchanged within 14 days of delivery directly from your Account -> My Orders portal.',
                    },
                    {
                      heading: 'Refund Processing',
                      body: 'Once inspected by our quality specialists, refunds are issued to your original card or bank account within 5 business days.',
                    },
                  ]}
                />
              }
            />
            <Route
              path="/privacy-policy"
              element={
                <PolicyDocumentPage
                  kicker="Data Governance"
                  title="Privacy Policy"
                  sections={[
                    {
                      heading: 'Zero-Trust PII Isolation',
                      body: 'Your email address, mobile phone number, and Pakistani street addresses are stored in isolated private Firestore collections accessible strictly to your authenticated session and verified fulfillment administrators.',
                    },
                  ]}
                />
              }
            />
            <Route
              path="/terms"
              element={
                <PolicyDocumentPage
                  kicker="Conditions of Sale"
                  title="Terms & Conditions"
                  sections={[
                    {
                      heading: 'Authentic AUREVÉ Creations',
                      body: 'All garments, accessories, and fragrances sold on this digital flagship are guaranteed authentic AUREVÉ editions.',
                    },
                    {
                      heading: 'Server-Verified Pricing & Availability',
                      body: 'Order totals, promotional coupons, and stock allocations are validated authoritatively at checkout to prevent overselling.',
                    },
                  ]}
                />
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </LayoutShell>
      </StoreProvider>
    </BrowserRouter>
  );
}
