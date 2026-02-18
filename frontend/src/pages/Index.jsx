import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AuthBackground } from "@/components/auth/AuthBackground";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-dscreen items-center justify-center relative">
      <AuthBackground />
      <div className="relative z-10 text-center backdrop-blur-xl bg-card/40 border border-white/10 rounded-3xl p-12 shadow-[0_8px_32px_rgba(0,0,0,0.4),0_-2px_16px_rgba(255,255,255,0.05)] max-w-lg w-full mx-4">
        <h1 className="mb-4 text-5xl font-bold text-foreground">Welcome</h1>
        <p className="text-xl text-muted-foreground mb-8">
          Modern Neomorphic Authentication
        </p>
        <Button
          onClick={() => navigate("/login")}
          variant="neomorphic"
          size="lg"
        >
          Go to Login
        </Button>
      </div>
    </div>
  );
};

export default Index;
