import React, { useState, useMemo, useEffect } from "react";
import { Download, Search, Trash2, Loader } from "lucide-react";
import { CSVLink } from "react-csv";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";

const DatabankPage = ({ user, programs, facilities, db, onSuperAdminDelete }) => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [programFilter, setProgramFilter] = useState("all");
  const [facilityFilter, setFacilityFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");

  useEffect(() => {
    if (!user || !db) return;

    setLoading(true);
    let submissionsQuery;

    // Base query for confirmed submissions, ordered by most recent first
    const baseQuery = query(
      collection(db, "submissions"),
      where("confirmed", "==", true),
      orderBy("timestamp", "desc")
    );

    // If user is a facility user/admin, only show their facility's data.
    // Otherwise, admins and other roles can see all confirmed submissions.
    if (user.role === "Facility User" || user.role === "Facility Admin") {
      submissionsQuery = query(baseQuery, where("facilityId", "==", user.facilityId));
    } else {
      submissionsQuery = baseQuery;
    }

    const unsubscribe = onSnapshot(
      submissionsQuery,
      (snapshot) => {
        const fetchedSubmissions = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setSubmissions(fetchedSubmissions);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching databank submissions:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, db]);

  const availableYears = useMemo(() => {
    const years = new Set(
      submissions.map((sub) => sub.timestamp?.toDate().getFullYear()).filter(Boolean)
    );
    return Array.from(years).sort((a, b) => b - a);
  }, [submissions]);

  const filteredSubmissions = useMemo(() => {
    return submissions
      .filter((sub) => {
        const program = programs.find((p) => p.id === sub.programId);
        const facility = facilities.find((f) => f.id === sub.facilityId);
        const searchText = searchTerm.toLowerCase();

        const matchesSearch =
          !searchTerm ||
          sub.fileName?.toLowerCase().includes(searchText) ||
          program?.name.toLowerCase().includes(searchText) ||
          facility?.name.toLowerCase().includes(searchText);

        const matchesProgram = programFilter === "all" || sub.programId === programFilter;
        const matchesFacility = facilityFilter === "all" || sub.facilityId === facilityFilter;
        
        const submissionDate = sub.timestamp?.toDate();
        const matchesMonth = monthFilter === "all" || (submissionDate && submissionDate.getMonth() + 1 === parseInt(monthFilter));
        const matchesYear = yearFilter === "all" || (submissionDate && submissionDate.getFullYear() === parseInt(yearFilter));

        return matchesSearch && matchesProgram && matchesFacility && matchesMonth && matchesYear;
      })
  }, [submissions, searchTerm, programFilter, facilityFilter, monthFilter, yearFilter, programs, facilities]);

  const csvData = useMemo(() => {
    return filteredSubmissions.map((sub) => {
      const program = programs.find((p) => p.id === sub.programId);
      const facility = facilities.find((f) => f.id === sub.facilityId);
      return {
        Program: program?.name || "N/A",
        Facility: facility?.name || "N/A",
        FileName: sub.fileName,
        SubmittedBy: sub.userName,
        SubmissionDate: sub.timestamp?.toDate().toLocaleDateString(),
        MorbidityWeek: sub.morbidityWeek || "N/A",
        SubmissionMonth: sub.submissionMonth || "N/A",
        SubmissionYear: sub.submissionYear || "N/A",
        Status: sub.confirmed ? "Approved" : "Pending",
      };
    });
  }, [filteredSubmissions, programs, facilities]);

  const months = [
    { value: 1, name: "January" }, { value: 2, name: "February" }, { value: 3, name: "March" },
    { value: 4, name: "April" }, { value: 5, name: "May" }, { value: 6, name: "June" },
    { value: 7, name: "July" }, { value: 8, name: "August" }, { value: 9, name: "September" },
    { value: 10, name: "October" }, { value: 11, name: "November" }, { value: 12, name: "December" }
  ];

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Databank</h1>
          <p className="text-gray-600">Browse and download approved submissions.</p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by file, program, or facility..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
            <div>
              <select
                value={programFilter}
                onChange={(e) => setProgramFilter(e.target.value)}
                className="w-full p-2 border rounded-lg bg-white focus:ring-primary focus:border-primary"
              >
                <option value="all">All Programs</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            {user.role !== "Facility User" && user.role !== "Facility Admin" && (
              <div>
                <select
                  value={facilityFilter}
                  onChange={(e) => setFacilityFilter(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white focus:ring-primary focus:border-primary"
                >
                  <option value="all">All Facilities</option>
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
             <div>
              <select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="w-full p-2 border rounded-lg bg-white focus:ring-primary focus:border-primary"
              >
                <option value="all">All Months</option>
                {months.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="w-full p-2 border rounded-lg bg-white focus:ring-primary focus:border-primary"
              >
                <option value="all">All Years</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end mb-4">
          <CSVLink
            data={csvData}
            filename={"apdms-databank-export.csv"}
            className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </CSVLink>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                <tr>
                  <th scope="col" className="px-6 py-3">Program</th>
                  <th scope="col" className="px-6 py-3">Facility</th>
                  <th scope="col" className="px-6 py-3">File Name</th>
                  <th scope="col" className="px-6 py-3">Submission Date</th>
                  <th scope="col" className="px-6 py-3">Period</th>
                  <th scope="col" className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-10">
                      <div className="flex justify-center items-center">
                        <Loader className="w-6 h-6 animate-spin mr-2" />
                        <span>Loading data...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredSubmissions.length > 0 ? (
                  filteredSubmissions.map((sub) => {
                    const program = programs.find((p) => p.id === sub.programId);
                    const facility = facilities.find((f) => f.id === sub.facilityId);
                    const periodText = sub.morbidityWeek
                      ? `Week ${sub.morbidityWeek}, ${sub.submissionYear}`
                      : `${new Date(sub.submissionYear, sub.submissionMonth - 1).toLocaleString("default", {
                          month: "long",
                        })}, ${sub.submissionYear}`;

                    return (
                      <tr key={sub.id} className="bg-white border-b hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">{program?.name || "N/A"}</td>
                        <td className="px-6 py-4">{facility?.name || "N/A"}</td>
                        <td className="px-6 py-4">
                          {sub.fileURL ? (
                            <a
                              href={sub.fileURL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {sub.fileName}
                            </a>
                          ) : (
                            <span className="text-gray-400 italic">{sub.fileName}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">{sub.timestamp?.toDate().toLocaleDateString()}</td>
                        <td className="px-6 py-4">{periodText}</td>
                        <td className="px-6 py-4 flex items-center space-x-2">
                          {sub.fileURL && (
                            <a
                              href={sub.fileURL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-primary hover:bg-gray-100 rounded-full"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                          {user.role === "Super Admin" && (
                            <button
                              onClick={() => onSuperAdminDelete(sub.id, "approve")}
                              className="p-2 text-red-600 hover:bg-red-100 rounded-full"
                              title="Delete Submission"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="text-center py-10 text-gray-500">
                      No approved submissions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabankPage;
