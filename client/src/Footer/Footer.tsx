import "./Footer.css";
import instagram from "./instagram.png";
import linkedin from "./linkedin.png";
import twitter from "./twitter.png";

const Footer = () => {
  const handleSocialMedia = (socialMedia: string) => {
    if (socialMedia === "instagram") {
      window.open("https://www.instagram.com/mathmaverick_man", "_blank");
    } else if (socialMedia === "linkedin") {
      window.open("https://www.linkedin.com/in/kumar-devashishh", "_blank");
    } else if (socialMedia === "twitter") {
      window.open("https://x.com/kumarde10248", "_blank");
    }
  };
  return (
    <div className="footerMainDiv">
      <div className="footerText">Made with ❤️ by Devashish</div>
      <div className="footerImgDiv">
        <img
          src={instagram}
          alt="instagram"
          width={25}
          className="footerImg"
          onClick={() => {
            handleSocialMedia("instagram");
          }}
        />
        <img
          src={linkedin}
          alt="linkedin"
          width={25}
          className="footerImg"
          onClick={() => {
            handleSocialMedia("linkedin");
          }}
        />
        <img
          src={twitter}
          alt="twitter"
          width={25}
          className="footerImg footerImgTwit"
          onClick={() => {
            handleSocialMedia("twitter");
          }}
        />
      </div>
    </div>
  );
};

export default Footer;
