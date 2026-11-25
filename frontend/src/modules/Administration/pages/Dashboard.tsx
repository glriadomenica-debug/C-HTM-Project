import CrudActions from "../../../components/CrudActions";

export default function Dashboard() {
  const statistics = [
    {
      title: "Total Utilizador",
      value: "0",
      description: "",
      icon: "👥",
    },
    {
      title: "Total Membru",
      value: "0",
      description: "",
      icon: "🧑‍🤝‍🧑",
    },
    {
      title: "Emprestimu Aktiva",
      value: "0",
      description: "",
      icon: "💰",
    },
    {
      title: "Pending Payments",
      value: "0",
      description: "Payments awaiting review",
      icon: "🧾",
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Bemvindu mai sistema manajementu C-HTM.
        </p>
      </div>

      {/* Statistik responsif */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 sm:gap-5">
        {statistics.map((item) => (
          <div
            key={item.title}
            className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-gray-500">{item.title}</p>
              <span className="text-2xl" aria-hidden="true">
                {item.icon}
              </span>
            </div>

            <h2 className="mt-3 text-2xl font-bold text-gray-900 sm:mt-4 sm:text-3xl">
              {item.value}
            </h2>

            <p className="mt-2 text-xs text-gray-500">{item.description}</p>
          </div>
        ))}
      </div>

      {/* Aktivitas terbaru */}
      <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-gray-900 sm:text-lg">
          Aktividade resente
        </h2>

        <p className="mt-2 text-sm text-gray-500">
          Transaksaun resente no aktividade husi sistema sei mosu iha ne'e
        </p>

        <div className="mt-5 rounded-lg border border-dashed border-gray-300 p-5 text-center sm:p-8">
          <p className="text-sm text-gray-500">Seidauk iha aktividade</p>
        </div>
        <CrudActions
          canView={true}
          canCreate={true}
          canEdit={true}
          canDelete={true}
          onView={() => console.log("View data")}
          onCreate={() => console.log("Add data")}
          onEdit={() => console.log("Edit data")}
          onDelete={() => console.log("Delete data")}
        />
      </section>
    </div>
  );
}
