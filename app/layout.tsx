import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://coffee-break-games.uclick-ljw.chatgpt.site'),
  title: '커피 한 판',
  description: '2명부터 한 기기로 즐기는 1분 보드게임 모음',
  openGraph: {
    title: '커피 한 판',
    description: '1분이면 끝나는 보드게임',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: '커피 한 판',
    description: '1분이면 끝나는 보드게임',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
