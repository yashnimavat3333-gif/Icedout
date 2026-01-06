import React, { useId } from "react";

export default function Input({
  label,
  type = "text",
  className = "",
  containerClass = "",
  labelClass = "",
  error,
  ref, // ref is now a regular prop
  ...props
}) {
  const id = useId();

  return (
    <div className={`w-full ${containerClass}`}>
      {label && (
        <label
          htmlFor={id}
          className={`block mb-1 text-sm font-medium text-gray-700 ${labelClass}`}
        >
          {label}
          {props.required && <span className="text-red-500"> *</span>}
        </label>
      )}
      <input
        id={id}
        type={type}
        ref={ref} // ref passed directly to input
        className={`w-full px-3 py-2 text-gray-900 placeholder-gray-400 border rounded-md shadow-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
          error
            ? "border-red-500 focus:ring-red-500 focus:border-red-500"
            : "border-gray-300"
        } ${
          props.disabled ? "bg-gray-100 cursor-not-allowed" : ""
        } ${className}`}
        {...props}
      />
      {typeof error === "string" && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
