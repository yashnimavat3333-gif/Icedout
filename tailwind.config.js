// tailwind.config.js
export default {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            colors: {
                icedout: {
                    dark: "#0b2706",
                    soft: "#a1d494",
                    accent: "#1a893a",
                    deep: "#274b24",
                },
            },
        },
    },
    plugins: [],
};
