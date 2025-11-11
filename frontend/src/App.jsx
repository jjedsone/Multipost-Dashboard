import PostForm from './components/PostForm.jsx';

function App() {
  return (
    <div className="app-shell">
      <h1>Multipost Dashboard</h1>
      <p className="subtitle">
        Envie vídeos, legendas e hashtags simultaneamente para YouTube, Instagram e TikTok.
      </p>
      <PostForm />
    </div>
  );
}

export default App;

