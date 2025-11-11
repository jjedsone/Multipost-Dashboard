import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';

const PLATFORM_OPTIONS = [
  { id: 'youtube', label: 'YouTube' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
];

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

function PostForm() {
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState(['youtube']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState('neutral');
  const [results, setResults] = useState(null);
  const [instagramStatus, setInstagramStatus] = useState({
    connected: false,
    page: null,
    updatedAt: null,
  });
  const [isCheckingInstagram, setIsCheckingInstagram] = useState(false);

  const instagramPollRef = useRef(null);
  const isUnmountedRef = useRef(false);

  const isVideo = useMemo(() => {
    if (!mediaFile) return false;
    return mediaFile.type.startsWith('video/');
  }, [mediaFile]);

  const togglePlatform = (platformId) => {
    setSelectedPlatforms((prev) => {
      if (prev.includes(platformId)) {
        return prev.filter((item) => item !== platformId);
      }
      return [...prev, platformId];
    });
  };

  const resetForm = () => {
    setTitle('');
    setCaption('');
    setTags('');
    setMediaFile(null);
    setSelectedPlatforms(['youtube']);
    setResults(null);
    setStatusMessage('');
    setStatusType('neutral');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!mediaFile) {
      setStatusMessage('Selecione um arquivo de mídia para enviar.');
      setStatusType('error');
      return;
    }

    if (!selectedPlatforms.length) {
      setStatusMessage('Escolha pelo menos uma plataforma.');
      setStatusType('error');
      return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('caption', caption);
    formData.append('tags', tags);
    formData.append('media', mediaFile);
    selectedPlatforms.forEach((platform) => formData.append('platforms', platform));

    try {
      setIsSubmitting(true);
      setStatusMessage('Enviando...');
      setStatusType('neutral');
      setResults(null);

      const response = await axios.post(`${API_BASE_URL}/post`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setResults(response.data?.results || null);
      setStatusMessage('Upload concluído! Verifique o status de cada plataforma abaixo.');
      setStatusType('success');
    } catch (error) {
      const detail =
        error.response?.data?.error || error.message || 'Erro desconhecido durante o upload.';
      setStatusMessage(detail);
      setStatusType('error');
      setResults(error.response?.data?.results || null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchInstagramStatus = async () => {
    try {
      setIsCheckingInstagram(true);
      const response = await axios.get(`${API_BASE_URL}/auth/instagram/status`);
      if (!isUnmountedRef.current) {
        setInstagramStatus(response.data);
      }
    } catch (error) {
      if (!isUnmountedRef.current) {
        setStatusMessage(
          error.response?.data?.error ||
            error.message ||
            'Falha ao verificar status do Instagram.',
        );
        setStatusType('error');
      }
    } finally {
      if (!isUnmountedRef.current) {
        setIsCheckingInstagram(false);
      }
    }
  };

  const connectInstagram = async () => {
    try {
      setStatusMessage('Abrindo login do Instagram (Meta)...');
      setStatusType('neutral');

      const { data } = await axios.get(`${API_BASE_URL}/auth/instagram/url`);
      if (!data?.url) {
        throw new Error('URL de autenticação não retornada.');
      }

      const authWindow = window.open(
        data.url,
        'instagramAuth',
        'width=600,height=700,menubar=no,status=no,scrollbars=yes',
      );

      if (!authWindow) {
        throw new Error('Permita pop-ups para conectar sua conta Instagram.');
      }

      if (instagramPollRef.current) {
        clearInterval(instagramPollRef.current);
      }

      instagramPollRef.current = setInterval(async () => {
        if (authWindow.closed) {
          clearInterval(instagramPollRef.current);
          instagramPollRef.current = null;
          await fetchInstagramStatus();
          return;
        }

        try {
          const statusResp = await axios.get(`${API_BASE_URL}/auth/instagram/status`, {
            params: { t: Date.now() },
          });

          if (statusResp.data?.connected) {
            clearInterval(instagramPollRef.current);
            instagramPollRef.current = null;
            setInstagramStatus(statusResp.data);
            setStatusMessage('Instagram conectado com sucesso!');
            setStatusType('success');
            authWindow.close();
          }
        } catch (pollError) {
          console.warn('[Instagram] Falha ao verificar status:', pollError);
        }
      }, 2000);
    } catch (error) {
      setStatusMessage(
        error.response?.data?.error || error.message || 'Não foi possível iniciar o login do Instagram.',
      );
      setStatusType('error');
    }
  };

  useEffect(() => {
    fetchInstagramStatus();

    return () => {
      isUnmountedRef.current = true;
      if (instagramPollRef.current) {
        clearInterval(instagramPollRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderInstagramStatus = () => {
    if (isCheckingInstagram) {
      return 'Verificando status...';
    }

    if (instagramStatus.connected && instagramStatus.page) {
      const { name } = instagramStatus.page;
      return `Conectado a ${name}`;
    }

    return 'Não conectado';
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return null;
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(timestamp));
    } catch {
      return timestamp;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="post-form" encType="multipart/form-data">
      <section className="integration-card">
        <div className="integration-card__info">
          <div className="integration-card__header">
            <span className={`status-dot ${instagramStatus.connected ? 'online' : 'offline'}`} />
            <h3>Instagram</h3>
          </div>
          <p>{renderInstagramStatus()}</p>
          {instagramStatus.updatedAt && (
            <small className="hint">Atualizado em {formatTimestamp(instagramStatus.updatedAt)}</small>
          )}
        </div>
        <button
          type="button"
          className="ghost"
          onClick={connectInstagram}
          disabled={isCheckingInstagram || isSubmitting}
        >
          {instagramStatus.connected ? 'Reconectar Instagram' : 'Conectar Instagram'}
        </button>
      </section>

      <fieldset className="field-group">
        <label htmlFor="title">Título (YouTube)</label>
        <input
          id="title"
          type="text"
          placeholder="Título do vídeo"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </fieldset>

      <fieldset className="field-group">
        <label htmlFor="caption">Legenda</label>
        <textarea
          id="caption"
          placeholder="Escreva a legenda (Instagram/TikTok também usam este campo)."
          value={caption}
          rows={4}
          onChange={(event) => setCaption(event.target.value)}
        />
      </fieldset>

      <fieldset className="field-group">
        <label htmlFor="tags">Tags (separe por vírgula)</label>
        <input
          id="tags"
          type="text"
          placeholder="ex: tutorial,react,node"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
        />
      </fieldset>

      <fieldset className="field-group">
        <label htmlFor="media">Arquivo de mídia</label>
        <input
          id="media"
          type="file"
          accept="video/*,image/*"
          onChange={(event) => setMediaFile(event.target.files[0] ?? null)}
        />
        {mediaFile && (
          <small className="hint">
            Arquivo selecionado: <strong>{mediaFile.name}</strong> ({Math.round(mediaFile.size / 1_048_576)}{' '}
            MB) • Tipo: {isVideo ? 'Vídeo' : 'Imagem'}
          </small>
        )}
      </fieldset>

      <fieldset className="field-group">
        <span className="field-label">Plataformas</span>
        <div className="platform-list">
          {PLATFORM_OPTIONS.map((platform) => (
            <label key={platform.id} className="checkbox">
              <input
                type="checkbox"
                name="platforms"
                value={platform.id}
                checked={selectedPlatforms.includes(platform.id)}
                onChange={() => togglePlatform(platform.id)}
              />
              <span>{platform.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="actions">
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Enviando...' : 'Publicar'}
        </button>
        <button type="button" className="ghost" onClick={resetForm} disabled={isSubmitting}>
          Limpar
        </button>
      </div>

      {statusMessage && (
        <div className={`status-bar ${statusType === 'error' ? 'error' : ''}`}>
          {statusMessage}
        </div>
      )}

      {results && (
        <div className="results">
          <h3 className="section-title">Resultados</h3>
          <ul>
            {Object.entries(results).map(([platform, payload]) => (
              <li key={platform}>
                <strong>{platform}:</strong>{' '}
                {payload?.ok
                  ? 'OK'
                  : 'Falhou'}
                {payload?.error && (
                  <>
                    {' '}
                    <em>{typeof payload.error === 'string' ? payload.error : JSON.stringify(payload.error)}</em>
                  </>
                )}
                {payload?.url && (
                  <>
                    {' '}
                    <a href={payload.url} target="_blank" rel="noreferrer">
                      Abrir
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}

export default PostForm;

