import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { DataProvider, useData } from './context/DataContext';
import Header from './components/Header';
import Footer from './components/Footer';
import PageTransitionWrapper from './components/PageTransitionWrapper';
import Home from './pages/Home';
import Footprints from './pages/Footprints';
import Gallery from './pages/Gallery';
import About from './pages/About';
import Admin from './pages/Admin';
import AnimationPlayground from './pages/AnimationPlayground';
import './App.css';

const AppContent: React.FC = () => {
  const { animationConfig } = useData();

  return (
    <div className="app">
      <Header />
      <main className="main-content">
        <PageTransitionWrapper transition={animationConfig.pageTransition}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/footprints" element={<Footprints />} />
            <Route path="/gallery/:id" element={<Gallery />} />
            <Route path="/about" element={<About />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/playground" element={<AnimationPlayground />} />
          </Routes>
        </PageTransitionWrapper>
      </main>
      <Footer />
    </div>
  );
};

function App() {
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}

export default App;
