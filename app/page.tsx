import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-white">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-toyota-primary">Toyota S.O.S</h1>
        <p className="text-lg text-gray-600">Driver Management System</p>
        <Button className="bg-toyota-primary hover:bg-red-700">
          Get Started
        </Button>
      </div>
    </main>
  );
}
