import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useNotification } from '@/contexts/NotificationContext';
import api from '@/services/api';
import { AuthBackground } from '@/components/auth/AuthBackground';
import { SEO } from '@/components/common/SEO';

const ResetPassword = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { showNotification } = useNotification();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const email = location.state?.email;
  const token = location.state?.token;
  
  // Если нет email или токена, перенаправляем на forgot-password
  if (!email || !token) {
    navigate('/forgot-password');
    return null;
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (password !== confirmPassword) {
      setError(t('auth.resetPassword.passwordMismatch'));
      return;
    }
    
    if (password.length < 6) {
      setError(t('auth.resetPassword.passwordTooShort'));
      return;
    }
    
    setIsLoading(true);
    
    try {
      await api.resetPassword(email, token, password);
      // Проверяем, что showNotification является функцией
      if (typeof showNotification === 'function') {
        showNotification(t('auth.resetPassword.success'), 'success');
      }
      navigate('/login');
    } catch (error) {
      console.error('Reset password error:', error);
      // Защита от ошибки "errors.generic"
      try {
        setError(t('errors.generic'));
      } catch (translationError) {
        setError('An error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <>
      <SEO
        title="Сброс пароля"
        description="Создайте новый пароль для доступа к Epochal Dialog. Безопасный сброс пароля."
        canonical="/reset-password"
      />
      <div
        className="relative flex w-full p-4 dark-theme-locked items-center justify-center auth-page-container"
        style={{ minHeight: '100%' }}
      >
      <AuthBackground />
      
      <div className="relative z-10 w-full max-w-[480px] flex items-center justify-center perspective-1000">
        <Card className="backdrop-blur-2xl bg-card/30 border border-white/10 rounded-[2rem] p-6 sm:p-8 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5),0_-4px_24px_rgba(255,255,255,0.08),inset_0_1px_0_rgba(255,255,255,0.1)] w-full animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-700 ease-out ring-1 ring-white/5 before:absolute before:inset-0 before:rounded-[2rem] before:bg-gradient-to-br before:from-white/5 before:via-transparent before:to-transparent before:pointer-events-none">
          <CardHeader className="text-center mb-6 sm:mb-8">
            <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 backdrop-blur-xl border border-primary/30 mb-4 shadow-[0_8px_24px_-4px_rgba(var(--primary),0.4),0_0_0_1px_rgba(255,255,255,0.05)_inset] transition-all duration-500 hover:scale-110 hover:rotate-3 hover:shadow-[0_12px_32px_-6px_rgba(var(--primary),0.6),0_0_0_1px_rgba(255,255,255,0.1)_inset] group before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-br before:from-white/10 before:via-transparent before:to-transparent before:pointer-events-none before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500">
              <img 
                src="/logo.webp"
                alt="Epochal Dialog"
                className="w-20 h-20 object-contain transition-transform duration-500 group-hover:scale-110"
              />
            </div>
            <CardTitle className="text-2xl sm:text-3xl font-bold text-foreground bg-gradient-to-b from-foreground via-foreground to-foreground/80 bg-clip-text tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
              {t('auth.resetPassword.title')}
            </CardTitle>
            <p className="text-sm text-muted-foreground/90 mt-2 font-medium leading-relaxed">
              {t('auth.resetPassword.subtitle')}
            </p>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label htmlFor="password" className="text-foreground/90 font-medium">
                  {t('auth.resetPassword.newPassword')}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="mt-2 h-12 rounded-xl border border-input/50 bg-background/20 backdrop-blur-sm px-4 py-3 text-foreground placeholder:text-muted-foreground/70 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/70 hover:border-input/70"
                />
              </div>
              
              <div>
                <Label htmlFor="confirmPassword" className="text-foreground/90 font-medium">
                  {t('auth.resetPassword.confirmPassword')}
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="mt-2 h-12 rounded-xl border border-input/50 bg-background/20 backdrop-blur-sm px-4 py-3 text-foreground placeholder:text-muted-foreground/70 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/70 hover:border-input/70"
                />
              </div>
              
              {error && (
                <p className="text-red-500 text-sm animate-in fade-in slide-in-from-top-1 duration-300">
                  {error}
                </p>
              )}
              
              <Button 
                type="submit" 
                className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground font-semibold shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                disabled={isLoading}
              >
                {isLoading ? t('auth.resetPassword.resetting') : t('auth.resetPassword.resetButton')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
};

export default ResetPassword;
