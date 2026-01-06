const ImageBanner = () => {
  return (
    <div className="w-full mx-auto mt-0 shadow-md overflow-hidden">
      <div className="aspect-w-16 h-[20rem] aspect-h-[20rem] lg:h-[700px]">
        <video
          src="https://fra.cloud.appwrite.io/v1/storage/buckets/6876009e002e889ffa51/files/691ec7db0033909fe4c3/view?project=6875fd9e000f3ec8a910"
          className="w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
        />
      </div>
    </div>
  );
};

export default ImageBanner;
