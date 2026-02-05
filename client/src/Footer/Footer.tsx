import "./Footer.css";
import instagram from "./instagram.png";
import linkedin from "./linkedin.png";
import twitter from "./twitter.png";

const Footer = () => {
  const handleSocialMedia = (socialMedia: string) => {
    if (socialMedia === "instagram") {
      window.open("https://www.instagram.com/kumardevashish48", "_blank");
    } else if (socialMedia === "linkedin") {
      window.open("https://www.linkedin.com/in/kumar-devashishh", "_blank");
    } else if (socialMedia === "twitter") {
      window.open("https://x.com/kumarDe10248", "_blank");
    }
  };
  return (
    <footer className="footerMainDiv" role="contentinfo" aria-label="Site footer">
      <div className="footerText">Made with ❤️ by Devashish</div>
      <nav className="footerImgDiv" aria-label="Social media links">
        <button
          type="button"
          onClick={() => handleSocialMedia("instagram")}
          className="footerImgButton"
          aria-label="Visit our Instagram page (opens in new tab)"
        >
          <img
            src={instagram}
            alt=""
            width={25}
            className="footerImg"
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          onClick={() => handleSocialMedia("linkedin")}
          className="footerImgButton"
          aria-label="Visit our LinkedIn page (opens in new tab)"
        >
          <img
            src={linkedin}
            alt=""
            width={25}
            className="footerImg"
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          onClick={() => handleSocialMedia("twitter")}
          className="footerImgButton"
          aria-label="Visit our Twitter page (opens in new tab)"
        >
          <img
            src={twitter}
            alt=""
            width={25}
            className="footerImg footerImgTwit"
            aria-hidden="true"
          />
        </button>
      </nav>
    </footer>
  );
};

export default Footer;
