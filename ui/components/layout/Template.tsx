import Footer from '../../pages/Footer'; 

export default function Template() {
  return ( 
    <section id="page-section" className="overflow-visible z-10 animate-fadeIn w-full h-[100vh] overflow-auto no-bar">
      <div className="CONTAINER w-full h-[100vh]">
          <div className="BACKGROUND-ELEMENTS ">
            <div className="BASE-BG gradient-1 w-full h-[100vh] absolute top-0 left-0"></div>     
            <div className="TOP-RIGHT-DIVIDER absolute top-0 left-0 divider-10 w-[33%] h-[50vmax]"></div>
          </div>
      </div>
      <div className="FOOTER-CONTAINER">
          <Footer />
      </div>
    </section>
  )
}