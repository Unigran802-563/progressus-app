import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    // Validação básica
    if (!email || !senha) {
      setErro('Por favor, preencha todos os campos');
      setCarregando(false);
      return;
    }

    if (!email.includes('@')) {
      setErro('Por favor, insira um email válido');
      setCarregando(false);
      return;
    }

    try {
      // Aqui você faria a chamada para sua API
      // const response = await fetch('/api/login', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ email, senha })
      // });
      
      // Por enquanto, simulamos um login bem-sucedido
      console.log('Login com:', { email, senha });
      
      // Salvar token no localStorage (se receber da API)
      localStorage.setItem('token', 'seu_token_aqui');
      localStorage.setItem('usuario', email);
      
      // Redirecionar para a página principal
      navigate('/dashboard');
    } catch (err) {
      setErro('Erro ao fazer login. Tente novamente.');
      console.error(err);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
        {/* Logo/Título */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Bem-vindo</h1>
          <p className="text-gray-600 mt-2">Faça login na sua conta</p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Campo Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          {/* Campo Senha */}
          <div>
            <label htmlFor="senha" className="block text-sm font-medium text-gray-700 mb-2">
              Senha
            </label>
            <input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          {/* Mensagem de Erro */}
          {erro && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
              {erro}
            </div>
          )}

          {/* Botão Login */}
          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {/* Links */}
        <div className="mt-6 space-y-3 text-center">
          <p className="text-sm text-gray-600">
            Não tem uma conta?{' '}
            <a href="/cadastro" className="text-blue-500 hover:text-blue-600 font-medium">
              Cadastre-se
            </a>
          </p>
          <p className="text-sm">
            <a href="#" className="text-gray-600 hover:text-gray-700">
              Esqueceu sua senha?
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}