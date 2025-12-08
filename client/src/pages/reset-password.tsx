import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation, useSearch } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, KeyRound, CheckCircle2, AlertCircle } from "lucide-react";
import logoHorizontal from "@/assets/logo-horizontal.png";

const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function ResetPassword() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const token = params.get("token");
  
  const [resetSuccess, setResetSuccess] = useState(false);

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPasswordFormData) => {
      const response = await apiRequest("POST", "/api/auth/reset-password", {
        token,
        password: data.password,
      });
      return response.json();
    },
    onSuccess: () => {
      setResetSuccess(true);
      toast({
        title: "Password reset successfully",
        description: "You can now log in with your new password.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Password reset failed",
        description: error.message || "The reset link may have expired. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ResetPasswordFormData) => {
    resetPasswordMutation.mutate(data);
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <Link href="/">
                <img 
                  src={logoHorizontal} 
                  alt="LeaseShield" 
                  className="h-12 cursor-pointer"
                  data-testid="link-logo-home"
                />
              </Link>
            </div>
            <div className="flex justify-center">
              <div className="rounded-full bg-destructive/10 p-3">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-semibold" data-testid="text-invalid-token-title">
                Invalid Reset Link
              </CardTitle>
              <CardDescription className="mt-2" data-testid="text-invalid-token-description">
                This password reset link is invalid or has expired. Please request a new one.
              </CardDescription>
            </div>
          </CardHeader>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              className="w-full"
              onClick={() => setLocation("/forgot-password")}
              data-testid="button-request-new-link"
            >
              Request New Link
            </Button>
            <Link 
              href="/login" 
              className="flex items-center justify-center gap-2 text-sm text-primary hover:underline"
              data-testid="link-back-to-login"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (resetSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <Link href="/">
                <img 
                  src={logoHorizontal} 
                  alt="LeaseShield" 
                  className="h-12 cursor-pointer"
                  data-testid="link-logo-home"
                />
              </Link>
            </div>
            <div className="flex justify-center">
              <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-3">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-semibold" data-testid="text-success-title">
                Password Reset Complete
              </CardTitle>
              <CardDescription className="mt-2" data-testid="text-success-description">
                Your password has been reset successfully. You can now log in with your new password.
              </CardDescription>
            </div>
          </CardHeader>
          <CardFooter>
            <Button
              className="w-full"
              onClick={() => setLocation("/login")}
              data-testid="button-go-to-login"
            >
              Go to Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Link href="/">
              <img 
                src={logoHorizontal} 
                alt="LeaseShield" 
                className="h-12 cursor-pointer"
                data-testid="link-logo-home"
              />
            </Link>
          </div>
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-3">
              <KeyRound className="h-8 w-8 text-primary" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-semibold" data-testid="text-reset-password-title">
              Create New Password
            </CardTitle>
            <CardDescription data-testid="text-reset-password-description">
              Enter your new password below. Make sure it's at least 8 characters.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter new password"
                        data-testid="input-new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Confirm new password"
                        data-testid="input-confirm-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={resetPasswordMutation.isPending}
                data-testid="button-reset-password-submit"
              >
                {resetPasswordMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter>
          <Link 
            href="/login" 
            className="flex items-center justify-center gap-2 w-full text-sm text-primary hover:underline"
            data-testid="link-back-to-login"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
