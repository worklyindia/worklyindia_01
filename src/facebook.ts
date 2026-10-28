// src/facebook.ts
export const initFacebookSDK = () => {
  return new Promise<void>((resolve) => {
    if (document.getElementById("facebook-jssdk")) {
      resolve();
      return;
    }

    (window as any).fbAsyncInit = function () {
      (window as any).FB.init({
        appId: "1092186133267704",
        cookie: true,
        xfbml: true,
        version: "v21.0", // ✅ Latest API version
      });
      (window as any).FB.AppEvents.logPageView();
      resolve();
    };

    const js = document.createElement("script");
    js.id = "facebook-jssdk";
    js.src = "https://connect.facebook.net/en_US/sdk.js";
    document.body.appendChild(js);
  });
};
