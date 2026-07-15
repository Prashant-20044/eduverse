import ParticleButton from '../components/ParticleButton';

export default function ParticleButtonDemo() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-12">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-white mb-4">Particle Button Effect</h1>
        <p className="text-gray-400 text-lg">Click the button to activate the particle animation</p>
      </div>

      <div className="flex flex-col gap-8 items-center">
        <ParticleButton>Activate</ParticleButton>
        <ParticleButton className="text-xl">Get Started</ParticleButton>
        <ParticleButton>Learn More</ParticleButton>
      </div>

      <div className="mt-20 max-w-2xl text-center text-gray-300">
        <h2 className="text-2xl font-semibold text-white mb-4">How it Works</h2>
        <p>
          This interactive button features a 3D particle animation that activates on click. 
          The particles move through Z-space, creating a depth effect. The button toggles between 
          white and black backgrounds with matching text colors.
        </p>
      </div>
    </div>
  );
}
