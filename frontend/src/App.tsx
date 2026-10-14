import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { UploadPage } from './pages/UploadPage';
import { ChatPage } from './pages/ChatPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/chat/:documentId" element={<ChatPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;