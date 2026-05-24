import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Cadastro() {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: '',
    confirmarSenha: '',
  });
  const [erros, setErros] = useState({});
  const [carregando, setCarregando] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Limpar erro do campo quando o usuário começa a digitar
    if (erros[name]) {
      setErros((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const validarFormulario = () => {
    const novosErros = {};

    if (!formData.nome.trim()) {
      novosErros.nome = 'Nome é obrigatório';
    } else if (formData.nome.trim().length < 3) {
      novosErros.nome = 'Nome deve ter pelo menos 3 caracteres';
    }

    if (!formData.email.trim()) {
      novosErros.email = 'Email é obrigatório';
    } else if (!formData.email.includes('@')) {
      novosErros.email = 'Email inválido';
    }

    if (!formData.senha) {
      novosErros.senha = 'Senha é obrigatória';
    } else if (formData.senha.length < 6) {
      novosErros.senha = 'Senha deve ter pelo menos 6 caracteres';
    }

    if (!formData.confirmarSenha) {
      novosErros.confirmarSenha = 'Confirme sua senha';
    } else if (formData.senha !== formData.confirmarSenha) {
      novosErros.confirmarSenha = 'As senhas não coincidem';
    }

    return novosErros;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const novosErros = validarFormulario();

    if (Object.keys(novosErros).length > 0) {
      setErros(novosErros);
      return;
    }

    setCarregando(true);

    try {
      // Aqui você faria a chamada para sua API
      // const response = await fetch('/api/cadastro', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     nome: formData.nome,
      //     email: formData.email,
      //     senha: formData.senha,
      //   })
      // });

      console.log('Cadastro com:', formData);

      // Salvar dados no localStorage (se receber da API)
      localStorage.setItem('usuario', formData.email);

      // Redirecionar para login
      navigate('/login');
    } catch (err) {
      setErros({ geral: 'Erro ao cadastrar. Tente novamente.' });
      console.error(err);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
        {/* Título */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Criar Conta</h1>
          <p className="text-gray-600 mt-2">Preencha os dados abaixo</p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Erro Geral */}
          {erros.geral && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
              {erros.geral}
            </div>
          )}

          {/* Campo Nome */}
          <div>
            <label htmlFor="nome" className="block text-sm font-medium text-gray-700 mb-2">
              Nome Completo
            </label>
            <input
              id="nome"
              type="text"
              name="nome"
              value={formData.nome}
              onChange={handleChange}
              placeholder="Seu nome completo"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition ${
                erros.nome
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-green-500'
              }`}
            />
            {erros.nome && <p className="text-red-500 text-sm mt-1">{erros.nome}</p>}
          </div>

          {/* Campo Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="seu@email.com"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition ${
                erros.email
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-green-500'
              }`}
            />
            {erros.email && <p className="text-red-500 text-sm mt-1">{erros.email}</p>}
          </div>

          {/* Campo Senha */}
          <div>
            <label htmlFor="senha" className="block text-sm font-medium text-gray-700 mb-2">
              Senha
            </label>
            <input
              id="senha"
              type="password"
              name="senha"
              value={formData.senha}
              onChange={handleChange}
              placeholder="••••••••"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition ${
                erros.senha
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-green-500'
              }`}
            />
            {erros.senha && <p className="text-red-500 text-sm mt-1">{erros.senha}</p>}
          </div>

          {/* Campo Confirmar Senha */}
          <div>
            <label htmlFor="confirmarSenha" className="block text-sm font-medium text-gray-700 mb-2">
              Confirmar Senha
            </label>
            <input
              id="confirmarSenha"
              type="password"
              name="confirmarSenha"
              value={formData.confirmarSenha}
              onChange={handleChange}
              placeholder="••••••••"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition ${
                erros.confirmarSenha
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-green-500'
              }`}
            />
            {erros.confirmarSenha && (
              <p className="text-red-500 text-sm mt-1">{erros.confirmarSenha}</p>
            )}
          </div>

          {/* Botão Cadastro */}
          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
          >
            {carregando ? 'Cadastrando...' : 'Cadastrar'}
          </button>
        </form>

        {/* Link para Login */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Já tem uma conta?{' '}
            <a href="/login" className="text-green-500 hover:text-green-600 font-medium">
              Faça login
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
