import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const handleLogin = (e: React.FormEvent) => { e.preventDefault(); setLocation("/"); };
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-hala-navy)] relative overflow-hidden">
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1920&q=80)", backgroundSize: "cover", backgroundPosition: "center" }} />
      <Card className="w-full max-w-md relative z-10 shadow-2xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="w-16 h-16 rounded-xl bg-[var(--color-hala-navy)] flex items-center justify-center mx-auto mb-4"><span className="text-white font-bold text-2xl font-serif">H</span></div>
          <CardTitle className="text-xl font-serif">Hala Commercial Engine</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div><Label htmlFor="email" className="text-xs">Email</Label><Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="amin@halascs.com" className="mt-1" /></div>
            <div><Label htmlFor="password" className="text-xs">Password</Label><Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" className="mt-1" /></div>
            <Button type="submit" className="w-full">Sign In</Button>
            <p className="text-[10px] text-center text-muted-foreground mt-4">Demo mode \u2014 any credentials will work</p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
