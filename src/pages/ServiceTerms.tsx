import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '@/components/ui/Header';
import Footer from '@/components/ui/Footer';

const ServiceTerms = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-900">
      <Header />
      <div className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-4xl">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">서비스 이용약관</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="prose max-w-none">
              <p className="text-center text-lg text-muted-foreground">
                서비스 이용약관 내용이 여기에 표시됩니다.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default ServiceTerms;
