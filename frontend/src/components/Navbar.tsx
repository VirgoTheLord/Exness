import React from "react";

const Navbar = () => {
  return (
    <div className="mx-auto w-screen bg-black h-15 flex items-center text-white">
      <div className="mx-2 flex w-screen items-center">
        <h1 className="text-white lowercase text-2xl ">Exness</h1>
        <div className="w-full flex justify-end items-center gap-2">
          <h1 className="text-sm bg-neutral-800 py-2 px-4 rounded-sm">
            Balance: 4000
          </h1>
          <button className="py-2 px-4 bg-neutral-800 rounded-sm text-sm">
            Deposit
          </button>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
