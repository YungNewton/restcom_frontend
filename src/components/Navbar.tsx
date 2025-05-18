// src/components/Navbar.tsx
const Navbar = () => {
    return (
      <nav className="flex justify-between items-center py-6 px-8 md:px-16 bg-black text-white">
        <div className="text-2xl font-bold">Restcom</div>
        <ul className="hidden md:flex gap-6 text-sm">
          <li><a href="#product" className="hover:text-blue-400">Product</a></li>
          <li><a href="#pricing" className="hover:text-blue-400">Pricing</a></li>
          <li><a href="#blog" className="hover:text-blue-400">Blog</a></li>
          <li><a href="#partners" className="hover:text-blue-400">Partners</a></li>
        </ul>
        <a href="#login" className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700">
          Login
        </a>
      </nav>
    )
  }
  
  export default Navbar
