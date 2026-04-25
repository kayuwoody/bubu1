import dynamic from 'next/dynamic';

const MenuApp = dynamic(() => import('@/components/MenuApp'), { ssr: false });

export default function Home() {
  return <MenuApp />;
}
