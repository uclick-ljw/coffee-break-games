import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '얼음 한 판',
  description: '펭귄을 떨어뜨리지 말고 얼음을 깨는 1분 보드게임',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
