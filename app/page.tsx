import dynamic from 'next/dynamic';

const MenuAppV2 = dynamic(() => import('@/components/MenuAppV2'), { ssr: false });

export default function Home() {
  return <MenuAppV2 />;
}
