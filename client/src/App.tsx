import './App.css'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Home from './Home/Home'
import Footer from './Footer/Footer';

function App() {

  return (
    <>
    <BrowserRouter>
    <Routes>
      <Route path='/' element={<Home />} />
    </Routes>
    </BrowserRouter>

    </>
  )
};

export default App;