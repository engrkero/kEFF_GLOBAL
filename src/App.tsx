import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthProvider } from './lib/AuthContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import ProductDetails from './pages/ProductDetails';
import Chat from './pages/Chat';
import Checkout from './pages/Checkout';
import Search from './pages/Search';
import Profile from './pages/Profile';
import Chats from './pages/Chats';
import Orders from './pages/Orders';
import OrderDetails from './pages/OrderDetails';
import Sell from './pages/Sell';
import Wishlist from './pages/Wishlist';
import Settings from './pages/Settings';
import Admin from './pages/Admin';
import InstallPrompt from './components/InstallPrompt';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <InstallPrompt />
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={
                <PageTransition>
                  <Home />
                </PageTransition>
              } />
              <Route path="/admin" element={
                <PageTransition>
                  <Admin />
                </PageTransition>
              } />
              <Route path="/browse" element={
                <PageTransition>
                  <Search />
                </PageTransition>
              } />
              <Route path="/profile/:id" element={
                <PageTransition>
                  <Profile />
                </PageTransition>
              } />
              <Route path="/orders" element={
                <PageTransition>
                  <Orders />
                </PageTransition>
              } />
              <Route path="/orders/:id" element={
                <PageTransition>
                  <OrderDetails />
                </PageTransition>
              } />
              <Route path="/sell" element={
                <PageTransition>
                  <Sell />
                </PageTransition>
              } />
              <Route path="/edit/:editId" element={
                <PageTransition>
                  <Sell />
                </PageTransition>
              } />
              <Route path="/wishlist" element={
                <PageTransition>
                  <Wishlist />
                </PageTransition>
              } />
              <Route path="/settings" element={
                <PageTransition>
                  <Settings />
                </PageTransition>
              } />
              <Route path="/product/:id" element={
                <PageTransition>
                  <ProductDetails />
                </PageTransition>
              } />
              <Route path="/chat/:roomId" element={
                <PageTransition>
                  <Chat />
                </PageTransition>
              } />
              <Route path="/chats" element={
                <PageTransition>
                  <Chats />
                </PageTransition>
              } />
              <Route path="/checkout/:id" element={
                <PageTransition>
                  <Checkout />
                </PageTransition>
              } />
            </Routes>
          </AnimatePresence>
        </Layout>
      </Router>
    </AuthProvider>
  );
}

function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
}

